//! Process configuration, read once at startup and rejected whole when wrong.
//!
//! Failing here is the point: a service that started with no credential would either
//! serve its operations to anyone or refuse every caller while reporting healthy. Both
//! are worse than a deploy that does not come up.

use std::fmt;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};

/// Shortest bearer credential accepted. Matches v10r's own floor for bearer tokens
/// (`mcp/auth.ts` warns below 32) — long enough that guessing is not a strategy.
pub const MIN_TOKEN_LEN: usize = 32;
/// Default port when `PORT` is unset. Hosts that assign a port (Render) set `PORT`.
pub const DEFAULT_PORT: u16 = 8080;

/// A credential whose `Debug` output is redacted, so a stray `{:?}` cannot log it.
pub struct Secret(String);

impl Secret {
    pub fn expose(&self) -> &[u8] {
        self.0.as_bytes()
    }
}

impl fmt::Debug for Secret {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("Secret(<redacted>)")
    }
}

#[derive(Debug)]
pub struct Config {
    pub addr: SocketAddr,
    pub token: Secret,
}

/// Why startup was refused. The messages name the variable, never its value.
#[derive(Debug, PartialEq, Eq)]
pub enum ConfigError {
    MissingToken,
    ShortToken,
    InvalidHost,
    InvalidPort,
}

impl fmt::Display for ConfigError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            ConfigError::MissingToken => "SERVICE_TOKEN is not set",
            ConfigError::ShortToken => "SERVICE_TOKEN is shorter than 32 characters",
            ConfigError::InvalidHost => "HOST is not an IP address",
            ConfigError::InvalidPort => "PORT is not a port number",
        })
    }
}

impl Config {
    /// Build from an environment lookup. Taking a function instead of reading
    /// `std::env` directly keeps this testable without mutating process state.
    pub fn from_lookup(lookup: impl Fn(&str) -> Option<String>) -> Result<Config, ConfigError> {
        let host = match lookup("HOST") {
            None => IpAddr::V4(Ipv4Addr::UNSPECIFIED),
            Some(raw) => raw.parse().map_err(|_| ConfigError::InvalidHost)?,
        };
        let port = match lookup("PORT") {
            None => DEFAULT_PORT,
            Some(raw) => raw.parse().map_err(|_| ConfigError::InvalidPort)?,
        };
        let token = lookup("SERVICE_TOKEN")
            .filter(|t| !t.is_empty())
            .ok_or(ConfigError::MissingToken)?;
        if token.chars().count() < MIN_TOKEN_LEN {
            return Err(ConfigError::ShortToken);
        }
        Ok(Config {
            addr: SocketAddr::new(host, port),
            token: Secret(token),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const TOKEN: &str = "0123456789abcdef0123456789abcdef";

    fn config(vars: &[(&str, &str)]) -> Result<Config, ConfigError> {
        let vars: Vec<(String, String)> = vars
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect();
        Config::from_lookup(move |key| vars.iter().find(|(k, _)| k == key).map(|(_, v)| v.clone()))
    }

    #[test]
    fn defaults_bind_every_interface_on_8080() {
        let config = config(&[("SERVICE_TOKEN", TOKEN)]).unwrap();
        assert_eq!(config.addr, "0.0.0.0:8080".parse().unwrap());
    }

    #[test]
    fn port_and_host_are_honoured() {
        let config = config(&[
            ("SERVICE_TOKEN", TOKEN),
            ("PORT", "10000"),
            ("HOST", "127.0.0.1"),
        ])
        .unwrap();
        assert_eq!(config.addr, "127.0.0.1:10000".parse().unwrap());
    }

    #[test]
    fn missing_or_short_credential_fails_closed() {
        assert_eq!(config(&[]).unwrap_err(), ConfigError::MissingToken);
        assert_eq!(
            config(&[("SERVICE_TOKEN", "")]).unwrap_err(),
            ConfigError::MissingToken
        );
        assert_eq!(
            config(&[("SERVICE_TOKEN", "short")]).unwrap_err(),
            ConfigError::ShortToken
        );
    }

    #[test]
    fn malformed_bind_settings_are_refused() {
        assert_eq!(
            config(&[("SERVICE_TOKEN", TOKEN), ("PORT", "eighty")]).unwrap_err(),
            ConfigError::InvalidPort
        );
        assert_eq!(
            config(&[("SERVICE_TOKEN", TOKEN), ("HOST", "localhost")]).unwrap_err(),
            ConfigError::InvalidHost
        );
    }

    #[test]
    fn the_credential_never_reaches_debug_output() {
        let config = config(&[("SERVICE_TOKEN", TOKEN)]).unwrap();
        assert!(!format!("{config:?}").contains(TOKEN));
    }
}

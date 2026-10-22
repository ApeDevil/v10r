//! The order lifecycle — the service's whole domain, and deliberately the only module
//! that knows what an order is.
//!
//! Pure and deterministic: no HTTP, no serde, no clock, no I/O. The transport
//! (`http.rs`) and the wire shapes (`contract.rs`) map onto these types; nothing here
//! maps onto them. That is the same domain/adapter split v10r draws between
//! `$lib/server/[domain]/` and its route adapters, applied inside the service.
//!
//! Three answers are kept apart, because a caller acts on each differently:
//! - `Err(InvalidInput)` — the request is malformed for this domain (400). Retrying it
//!   unchanged can never succeed.
//! - `Ok(Evaluation::Refused)` — a well-formed request whose events break a rule. That is
//!   an answer, not a failure: the evaluation ran to a verdict.
//! - `Ok(Evaluation::Accepted)` — every event applied.

/// Most events one evaluation accepts. Bounds the work per request, so the cost of a
/// call is known before it is made.
pub const MAX_EVENTS: usize = 64;
/// Largest order total and largest single payment or refund, in cents.
pub const MAX_AMOUNT_CENTS: u64 = 100_000_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OrderState {
    Placed,
    PartiallyPaid,
    Paid,
    Shipped,
    Delivered,
    Cancelled,
    Refunded,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OrderEvent {
    Pay { amount_cents: u64 },
    Ship,
    Deliver,
    Cancel,
    Refund { amount_cents: u64 },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EventKind {
    Pay,
    Ship,
    Deliver,
    Cancel,
    Refund,
}

impl OrderEvent {
    pub fn kind(self) -> EventKind {
        match self {
            OrderEvent::Pay { .. } => EventKind::Pay,
            OrderEvent::Ship => EventKind::Ship,
            OrderEvent::Deliver => EventKind::Deliver,
            OrderEvent::Cancel => EventKind::Cancel,
            OrderEvent::Refund { .. } => EventKind::Refund,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RefusalReason {
    /// The event has no meaning in the current state (deliver before ship, anything after cancel).
    NotAllowedInState,
    /// Shipping was asked for before the order was paid in full.
    PaymentIncomplete,
    /// A payment above the open balance, or a refund above what is left to refund.
    ExceedsBalance,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Step {
    pub index: usize,
    pub event: EventKind,
    pub from: OrderState,
    pub to: OrderState,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Refusal {
    pub index: usize,
    pub event: EventKind,
    pub state: OrderState,
    pub reason: RefusalReason,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Ledger {
    pub paid_cents: u64,
    pub refunded_cents: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Evaluation {
    Accepted {
        steps: Vec<Step>,
        final_state: OrderState,
        ledger: Ledger,
    },
    Refused {
        steps: Vec<Step>,
        refusal: Refusal,
        ledger: Ledger,
    },
}

/// Why a request cannot be evaluated at all. `field` is a JSON-pointer-like location in
/// the request so the caller can point at the offending input.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InvalidInput {
    pub field: String,
    pub message: &'static str,
}

fn check_amount(field: String, amount: u64) -> Result<(), InvalidInput> {
    if amount == 0 || amount > MAX_AMOUNT_CENTS {
        return Err(InvalidInput {
            field,
            message: "must be between 1 and 100000000 cents",
        });
    }
    Ok(())
}

fn validate(total_cents: u64, events: &[OrderEvent]) -> Result<(), InvalidInput> {
    check_amount("/totalCents".into(), total_cents)?;
    if events.is_empty() || events.len() > MAX_EVENTS {
        return Err(InvalidInput {
            field: "/events".into(),
            message: "must hold between 1 and 64 events",
        });
    }
    for (index, event) in events.iter().enumerate() {
        if let OrderEvent::Pay { amount_cents } | OrderEvent::Refund { amount_cents } = event {
            check_amount(format!("/events/{index}/amountCents"), *amount_cents)?;
        }
    }
    Ok(())
}

/// The transition table. `Err` carries the refusal reason; the ledger is only touched
/// on success, so a refused event leaves no trace.
fn apply(
    state: OrderState,
    ledger: Ledger,
    total_cents: u64,
    event: OrderEvent,
) -> Result<(OrderState, Ledger), RefusalReason> {
    use OrderState::*;
    match (state, event) {
        (Placed | PartiallyPaid, OrderEvent::Pay { amount_cents }) => {
            // Bounded inputs make overflow impossible today; checked arithmetic keeps it
            // impossible if the bounds are ever raised.
            let paid = ledger
                .paid_cents
                .checked_add(amount_cents)
                .ok_or(RefusalReason::ExceedsBalance)?;
            if paid > total_cents {
                return Err(RefusalReason::ExceedsBalance);
            }
            let next = if paid == total_cents {
                Paid
            } else {
                PartiallyPaid
            };
            Ok((
                next,
                Ledger {
                    paid_cents: paid,
                    ..ledger
                },
            ))
        }
        (Placed | PartiallyPaid, OrderEvent::Ship) => Err(RefusalReason::PaymentIncomplete),
        (Paid, OrderEvent::Ship) => Ok((Shipped, ledger)),
        (Shipped, OrderEvent::Deliver) => Ok((Delivered, ledger)),
        (Placed | PartiallyPaid | Paid, OrderEvent::Cancel) => Ok((Cancelled, ledger)),
        (Delivered, OrderEvent::Refund { amount_cents }) => {
            let refunded = ledger
                .refunded_cents
                .checked_add(amount_cents)
                .ok_or(RefusalReason::ExceedsBalance)?;
            if refunded > ledger.paid_cents {
                return Err(RefusalReason::ExceedsBalance);
            }
            // A partial refund leaves the order delivered; the last cent closes it.
            let next = if refunded == ledger.paid_cents {
                Refunded
            } else {
                Delivered
            };
            Ok((
                next,
                Ledger {
                    refunded_cents: refunded,
                    ..ledger
                },
            ))
        }
        _ => Err(RefusalReason::NotAllowedInState),
    }
}

/// Evaluate `events` in order against a freshly placed order of `total_cents`.
/// Stops at the first refused event: later events were written assuming it applied.
pub fn evaluate(total_cents: u64, events: &[OrderEvent]) -> Result<Evaluation, InvalidInput> {
    validate(total_cents, events)?;

    let mut state = OrderState::Placed;
    let mut ledger = Ledger {
        paid_cents: 0,
        refunded_cents: 0,
    };
    let mut steps = Vec::with_capacity(events.len());

    for (index, event) in events.iter().copied().enumerate() {
        match apply(state, ledger, total_cents, event) {
            Ok((next, next_ledger)) => {
                steps.push(Step {
                    index,
                    event: event.kind(),
                    from: state,
                    to: next,
                });
                state = next;
                ledger = next_ledger;
            }
            Err(reason) => {
                return Ok(Evaluation::Refused {
                    steps,
                    refusal: Refusal {
                        index,
                        event: event.kind(),
                        state,
                        reason,
                    },
                    ledger,
                });
            }
        }
    }

    Ok(Evaluation::Accepted {
        steps,
        final_state: state,
        ledger,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use OrderEvent::*;

    fn accepted(total: u64, events: &[OrderEvent]) -> (OrderState, Ledger, Vec<Step>) {
        match evaluate(total, events).expect("valid input") {
            Evaluation::Accepted {
                final_state,
                ledger,
                steps,
            } => (final_state, ledger, steps),
            other => panic!("expected accepted, got {other:?}"),
        }
    }

    fn refusal(total: u64, events: &[OrderEvent]) -> Refusal {
        match evaluate(total, events).expect("valid input") {
            Evaluation::Refused { refusal, .. } => refusal,
            other => panic!("expected refused, got {other:?}"),
        }
    }

    #[test]
    fn full_lifecycle_with_split_payment_and_partial_refund() {
        let (state, ledger, steps) = accepted(
            5_000,
            &[
                Pay {
                    amount_cents: 2_000,
                },
                Pay {
                    amount_cents: 3_000,
                },
                Ship,
                Deliver,
                Refund { amount_cents: 500 },
            ],
        );
        assert_eq!(state, OrderState::Delivered);
        assert_eq!(
            ledger,
            Ledger {
                paid_cents: 5_000,
                refunded_cents: 500
            }
        );
        let path: Vec<_> = steps.iter().map(|s| s.to).collect();
        assert_eq!(
            path,
            [
                OrderState::PartiallyPaid,
                OrderState::Paid,
                OrderState::Shipped,
                OrderState::Delivered,
                OrderState::Delivered
            ]
        );
    }

    #[test]
    fn last_refunded_cent_closes_the_order() {
        let (state, _, _) = accepted(
            100,
            &[
                Pay { amount_cents: 100 },
                Ship,
                Deliver,
                Refund { amount_cents: 40 },
                Refund { amount_cents: 60 },
            ],
        );
        assert_eq!(state, OrderState::Refunded);
    }

    #[test]
    fn shipping_before_full_payment_is_refused_with_its_own_reason() {
        let refusal = refusal(100, &[Pay { amount_cents: 50 }, Ship]);
        assert_eq!(
            refusal,
            Refusal {
                index: 1,
                event: EventKind::Ship,
                state: OrderState::PartiallyPaid,
                reason: RefusalReason::PaymentIncomplete
            }
        );
    }

    #[test]
    fn overpayment_and_over_refund_are_refused() {
        assert_eq!(
            refusal(100, &[Pay { amount_cents: 101 }]).reason,
            RefusalReason::ExceedsBalance
        );
        assert_eq!(
            refusal(
                100,
                &[
                    Pay { amount_cents: 100 },
                    Ship,
                    Deliver,
                    Refund { amount_cents: 101 }
                ]
            )
            .reason,
            RefusalReason::ExceedsBalance
        );
    }

    #[test]
    fn cancel_is_allowed_only_before_shipping() {
        assert_eq!(accepted(100, &[Cancel]).0, OrderState::Cancelled);
        assert_eq!(
            refusal(100, &[Pay { amount_cents: 100 }, Ship, Cancel]).reason,
            RefusalReason::NotAllowedInState
        );
        assert_eq!(
            refusal(100, &[Cancel, Pay { amount_cents: 1 }]).reason,
            RefusalReason::NotAllowedInState
        );
    }

    #[test]
    fn a_refusal_stops_evaluation_and_keeps_the_ledger_of_accepted_steps() {
        match evaluate(
            100,
            &[Pay { amount_cents: 30 }, Deliver, Pay { amount_cents: 70 }],
        )
        .unwrap()
        {
            Evaluation::Refused {
                steps,
                ledger,
                refusal,
            } => {
                assert_eq!(steps.len(), 1);
                assert_eq!(ledger.paid_cents, 30);
                assert_eq!(refusal.index, 1);
            }
            other => panic!("expected refused, got {other:?}"),
        }
    }

    #[test]
    fn invalid_input_is_not_a_refusal() {
        assert_eq!(evaluate(0, &[Ship]).unwrap_err().field, "/totalCents");
        assert_eq!(evaluate(100, &[]).unwrap_err().field, "/events");
        assert_eq!(
            evaluate(100, &[Ship; MAX_EVENTS + 1]).unwrap_err().field,
            "/events"
        );
        assert_eq!(
            evaluate(100, &[Ship, Pay { amount_cents: 0 }])
                .unwrap_err()
                .field,
            "/events/1/amountCents"
        );
        assert_eq!(
            evaluate(
                100,
                &[Refund {
                    amount_cents: MAX_AMOUNT_CENTS + 1
                }]
            )
            .unwrap_err()
            .field,
            "/events/0/amountCents"
        );
        assert!(evaluate(MAX_AMOUNT_CENTS, &[Ship; MAX_EVENTS]).is_ok());
    }

    #[test]
    fn evaluation_is_deterministic() {
        let events = [
            Pay { amount_cents: 10 },
            Ship,
            Pay { amount_cents: 90 },
            Ship,
        ];
        assert_eq!(evaluate(100, &events), evaluate(100, &events));
    }
}

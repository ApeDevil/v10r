<script lang="ts">
interface Props {
	class?: string;
}

let { class: className }: Props = $props();

const frame1 = `
        _.,----,._
      .:'        \`:.
    .'    .--.      '.
   /    .'    '.      \\
  ;   .'   _    '.     ;
  |  /   ,' \`.    \\    |
  | ;   ;  @ '.    ;   |
  | |   |      |   |   |
  | ;   '.    .'   ;   |
  |  \\    '._.'   /    |
  ;   '.         .'    ;
   \\    '-.___.-'     /
    '.               .'
      ':.         .:'
        '-.___.-'
           ||
          _||_
         / || \\
        /  ||  \\
       /_._||_._\\
        |      |
        '.____.'
  `;

const frame2 = `
        _.,----,._
      .:'        \`:.
    .'    .--.      '.
   /    .'    '.      \\
  ;   .'   _    '.     ;
  |  /   ,' \`.    \\    |
  | ;   ;  · '.    ;   |
  | |   |      |   |   |
  | ;   '.    .'   ;   |
  |  \\    '._.'   /    |
  ;   '.         .'    ;
   \\    '-.___.-'     /
    '.               .'
      ':.         .:'
        '-.___.-'
           ||
          _||_
         / || \\
        /  ||  \\
       /_._||_._\\
        |      |
        '.____.'
  `;
</script>

<div class="raptor-container {className ?? ''}" aria-hidden="true">
	<pre class="raptor-frame frame-a">{frame1}</pre>
	<pre class="raptor-frame frame-b">{frame2}</pre>
</div>

<style>
	.raptor-container {
		position: relative;
		font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace;
		font-size: clamp(0.5rem, 1.5vw, 0.875rem);
		line-height: 1.2;
		user-select: none;
	}

	.raptor-frame {
		margin: 0;
		white-space: pre;
		color: currentColor;
	}

	.frame-a {
		animation: breathe-a 4.5s ease-in-out infinite;
	}

	.frame-b {
		position: absolute;
		inset: 0;
		animation: breathe-b 4.5s ease-in-out infinite;
	}

	@keyframes breathe-a {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.85; }
	}

	@keyframes breathe-b {
		0%, 100% { opacity: 0; }
		50% { opacity: 0.15; }
	}

	@media (prefers-reduced-motion: reduce) {
		.frame-a {
			animation: none;
			opacity: 1;
		}
		.frame-b {
			animation: none;
			opacity: 0;
		}
	}

	@media (forced-colors: active) {
		.raptor-container {
			opacity: 1;
		}
	}
</style>

<script lang="ts">
	import { DemoCard } from '../_components';
	import { Stack, Cluster, Grid, Center } from '$lib/components';
</script>

<section id="layout" class="section">
	<h2 class="section-title">Layout</h2>
	<p class="section-description">Primitives for composing page structure and spatial relationships.</p>

	<div class="demos">
		<!-- Stack -->
		<DemoCard title="Stack" description="Vertical layout with consistent gaps">
			<div class="layout-demo">
				<div class="demo-group">
					<span class="demo-label">gap="2"</span>
					<Stack gap="2">
						<div class="box">1</div>
						<div class="box">2</div>
						<div class="box">3</div>
					</Stack>
				</div>
				<div class="demo-group">
					<span class="demo-label">gap="4"</span>
					<Stack gap="4">
						<div class="box">1</div>
						<div class="box">2</div>
						<div class="box">3</div>
					</Stack>
				</div>
				<div class="demo-group">
					<span class="demo-label">gap="6"</span>
					<Stack gap="6">
						<div class="box">1</div>
						<div class="box">2</div>
						<div class="box">3</div>
					</Stack>
				</div>
			</div>
		</DemoCard>

		<!-- Cluster -->
		<DemoCard title="Cluster" description="Horizontal layout with wrapping and alignment">
			<div class="layout-demo-vertical">
				<div class="demo-group">
					<span class="demo-label">justify="start"</span>
					<Cluster justify="start" gap="3">
						<div class="box">A</div>
						<div class="box">B</div>
						<div class="box">C</div>
						<div class="box">D</div>
						<div class="box">E</div>
					</Cluster>
				</div>
				<div class="demo-group">
					<span class="demo-label">justify="center"</span>
					<Cluster justify="center" gap="3">
						<div class="box">A</div>
						<div class="box">B</div>
						<div class="box">C</div>
					</Cluster>
				</div>
				<div class="demo-group">
					<span class="demo-label">justify="between"</span>
					<Cluster justify="between" gap="3">
						<div class="box">A</div>
						<div class="box">B</div>
						<div class="box">C</div>
					</Cluster>
				</div>
			</div>
		</DemoCard>

		<!-- Grid -->
		<DemoCard title="Grid" description="CSS grid with consistent gaps">
			<div class="layout-demo-vertical">
				<div class="demo-group">
					<span class="demo-label">cols={2}</span>
					<Grid cols={2} gap="3">
						<div class="box">1</div>
						<div class="box">2</div>
						<div class="box">3</div>
						<div class="box">4</div>
					</Grid>
				</div>
				<div class="demo-group">
					<span class="demo-label">cols={3}</span>
					<Grid cols={3} gap="3">
						<div class="box">1</div>
						<div class="box">2</div>
						<div class="box">3</div>
						<div class="box">4</div>
						<div class="box">5</div>
						<div class="box">6</div>
					</Grid>
				</div>
				<div class="demo-group">
					<span class="demo-label">cols={4}</span>
					<Grid cols={4} gap="3">
						<div class="box">1</div>
						<div class="box">2</div>
						<div class="box">3</div>
						<div class="box">4</div>
					</Grid>
				</div>
			</div>
		</DemoCard>

		<!-- Center -->
		<DemoCard title="Center" description="Horizontally centered content with max-width">
			<div class="layout-demo-vertical">
				<div class="demo-group">
					<span class="demo-label">max="sm"</span>
					<div class="center-wrapper">
						<Center max="sm">
							<div class="box-wide">Centered (sm)</div>
						</Center>
					</div>
				</div>
				<div class="demo-group">
					<span class="demo-label">max="md"</span>
					<div class="center-wrapper">
						<Center max="md">
							<div class="box-wide">Centered (md)</div>
						</Center>
					</div>
				</div>
				<div class="demo-group">
					<span class="demo-label">max="lg"</span>
					<div class="center-wrapper">
						<Center max="lg">
							<div class="box-wide">Centered (lg)</div>
						</Center>
					</div>
				</div>
			</div>
		</DemoCard>

	</div>
</section>

<style>
	.section {
		scroll-margin-top: 5rem;
		margin-bottom: var(--spacing-8);
	}

	.section-title {
		font-size: var(--text-fluid-2xl);
		font-weight: 700;
		margin: 0 0 var(--spacing-2) 0;
		color: var(--color-fg);
	}

	.section-description {
		margin: 0 0 var(--spacing-7) 0;
		font-size: var(--text-fluid-base);
		color: var(--color-muted);
		line-height: 1.6;
	}

	.demos {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-6);
	}

	.layout-demo {
		display: flex;
		gap: var(--spacing-7);
		flex-wrap: wrap;
		width: 100%;
	}

	.layout-demo-vertical {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-6);
		width: 100%;
	}

	.demo-group {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.demo-label {
		font-size: var(--text-fluid-xs);
		font-family: 'Fira Code', monospace;
		color: var(--color-muted);
	}

	.box {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 3rem;
		height: 3rem;
		border-radius: var(--radius-md);
		background: var(--color-primary-light);
		color: var(--color-primary);
		font-weight: 600;
		font-size: var(--text-fluid-sm);
		flex-shrink: 0;
	}

	.box-wide {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 3rem;
		border-radius: var(--radius-md);
		background: var(--color-primary-light);
		color: var(--color-primary);
		font-weight: 600;
		font-size: var(--text-fluid-sm);
	}

	.center-wrapper {
		width: 100%;
		border: 1px dashed var(--color-border);
		border-radius: var(--radius-md);
		padding: var(--spacing-3);
	}

</style>

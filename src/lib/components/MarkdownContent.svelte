<script lang="ts">
	import { Marked } from 'marked';

	interface Props {
		content: string;
		class?: string;
	}

	let { content, class: className = '' }: Props = $props();

	let contentElement = $state<HTMLDivElement>();

	const marked = new Marked({
		breaks: true,
		gfm: true
	});

	const htmlContent = $derived.by(() => {
		try {
			return marked.parse(content) as string;
		} catch {
			return content;
		}
	});
</script>

<div
	bind:this={contentElement}
	class="markdown-content {className}"
>
	{@html htmlContent}
</div>

<style>
	.markdown-content {
		color: var(--foreground, theme('colors.zinc.300'));
		line-height: 1.8;
	}

	/* Headings */
	.markdown-content :global(h1) {
		font-size: 1.875rem;
		font-weight: 700;
		margin-top: 2.5rem;
		margin-bottom: 1rem;
		color: theme('colors.zinc.100');
		letter-spacing: -0.025em;
	}

	.markdown-content :global(h2) {
		font-size: 1.5rem;
		font-weight: 600;
		margin-top: 2rem;
		margin-bottom: 0.75rem;
		color: theme('colors.zinc.100');
		letter-spacing: -0.025em;
	}

	.markdown-content :global(h3) {
		font-size: 1.25rem;
		font-weight: 600;
		margin-top: 1.75rem;
		margin-bottom: 0.5rem;
		color: theme('colors.zinc.200');
	}

	.markdown-content :global(h4),
	.markdown-content :global(h5),
	.markdown-content :global(h6) {
		font-size: 1.1rem;
		font-weight: 600;
		margin-top: 1.5rem;
		margin-bottom: 0.5rem;
		color: theme('colors.zinc.200');
	}

	/* Remove top margin from first child heading */
	.markdown-content :global(:first-child) {
		margin-top: 0;
	}

	/* Paragraphs */
	.markdown-content :global(p) {
		font-size: 1.0625rem;
		line-height: 1.8;
		margin-bottom: 1.25rem;
		color: theme('colors.zinc.300');
	}

	/* Links */
	.markdown-content :global(a) {
		color: theme('colors.violet.400');
		text-decoration: underline;
		text-underline-offset: 2px;
		text-decoration-color: theme('colors.violet.400/40');
		transition: color 150ms ease, text-decoration-color 150ms ease;
	}

	.markdown-content :global(a:hover) {
		color: theme('colors.violet.300');
		text-decoration-color: theme('colors.violet.300');
	}

	/* Strong / Bold */
	.markdown-content :global(strong) {
		font-weight: 600;
		color: theme('colors.zinc.100');
	}

	/* Emphasis / Italic */
	.markdown-content :global(em) {
		font-style: italic;
	}

	/* Images */
	.markdown-content :global(img) {
		max-width: 100%;
		height: auto;
		border-radius: 0.5rem;
		margin-top: 1.5rem;
		margin-bottom: 1.5rem;
	}

	/* Unordered lists */
	.markdown-content :global(ul) {
		list-style-type: disc;
		padding-left: 1.5rem;
		margin-bottom: 1.25rem;
		color: theme('colors.zinc.300');
	}

	.markdown-content :global(ul > li) {
		margin-top: 0.375rem;
		line-height: 1.7;
	}

	/* Ordered lists */
	.markdown-content :global(ol) {
		list-style-type: decimal;
		padding-left: 1.5rem;
		margin-bottom: 1.25rem;
		color: theme('colors.zinc.300');
	}

	.markdown-content :global(ol > li) {
		margin-top: 0.375rem;
		line-height: 1.7;
	}

	/* Nested lists */
	.markdown-content :global(ul ul),
	.markdown-content :global(ol ul) {
		list-style-type: circle;
		margin-bottom: 0;
	}

	.markdown-content :global(ul ol),
	.markdown-content :global(ol ol) {
		margin-bottom: 0;
	}

	/* Blockquotes */
	.markdown-content :global(blockquote) {
		border-left: 3px solid theme('colors.zinc.700');
		padding-left: 1.25rem;
		margin: 1.5rem 0;
		font-style: italic;
		color: theme('colors.zinc.400');
	}

	.markdown-content :global(blockquote p) {
		color: theme('colors.zinc.400');
	}

	/* Inline code */
	.markdown-content :global(code) {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 0.875em;
		padding: 0.15em 0.35em;
		border-radius: 0.25rem;
		background-color: theme('colors.zinc.800/80');
		color: theme('colors.zinc.200');
	}

	/* Code blocks */
	.markdown-content :global(pre) {
		margin: 1.5rem 0;
		border-radius: 0.5rem;
		overflow: hidden;
	}

	.markdown-content :global(pre code) {
		display: block;
		padding: 1rem;
		overflow-x: auto;
		font-size: 0.8125rem;
		line-height: 1.6;
		background-color: theme('colors.zinc.900');
		border: 1px solid theme('colors.zinc.800/60');
		border-radius: 0.5rem;
	}

	/* Horizontal rules */
	.markdown-content :global(hr) {
		margin: 2.5rem 0;
		border: 0;
		border-top: 1px solid theme('colors.zinc.800/60');
	}

	/* Tables */
	.markdown-content :global(table) {
		width: 100%;
		border-collapse: collapse;
		margin: 1.5rem 0;
		font-size: 0.9375rem;
	}

	.markdown-content :global(th) {
		text-align: left;
		padding: 0.625rem 0.75rem;
		border-bottom: 2px solid theme('colors.zinc.700');
		font-weight: 600;
		color: theme('colors.zinc.200');
	}

	.markdown-content :global(td) {
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid theme('colors.zinc.800/60');
		color: theme('colors.zinc.300');
	}

	/* Strikethrough */
	.markdown-content :global(del) {
		text-decoration: line-through;
		color: theme('colors.zinc.500');
	}

	/* Task lists (GFM) */
	.markdown-content :global(ul:has(input[type="checkbox"])) {
		list-style: none;
		padding-left: 0;
	}

	.markdown-content :global(input[type="checkbox"]) {
		margin-right: 0.5rem;
		accent-color: theme('colors.violet.500');
	}
</style>

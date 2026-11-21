export default { title: 'Epsilon/Welcome', parameters: { layout: 'padded' } };

// target="_top": the story renders inside the hub's preview iframe. Without it a link opened the
// product's Storybook inside that frame, so its own sidebar and menu weren't reachable.
export const Overview = {
	render: () => `
<main style="font-family: system-ui, sans-serif; max-width: 40em; line-height: 1.5">
	<h1>Epsilon Storybook</h1>
	<p>Components for every Epsilon product, in one sidebar. Each product's stories are built in its own repository and published separately.</p>
	<p>Browse every component in the sidebar, or open a product's own Storybook in full (with its menu and all its components):</p>
	<ul>
		<li><a href="https://storybook.labelkit.co/" target="_top">LabelKit Storybook</a></li>
		<li><a href="https://storybook.audiokit.ai/" target="_top">AudioKit Storybook</a></li>
	</ul>
	<p>Stories use made-up data only.</p>
</main>`
};

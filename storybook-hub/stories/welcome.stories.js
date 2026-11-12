export default { title: 'Epsilon/Welcome', parameters: { layout: 'padded' } };

export const Overview = {
	render: () => `
<main style="font-family: system-ui, sans-serif; max-width: 40em; line-height: 1.5">
	<h1>Epsilon Storybook</h1>
	<p>Components for every Epsilon product, in one sidebar. Each product's stories are built in its own repository and published separately.</p>
	<ul><li><a href="https://storybook.labelkit.co">LabelKit</a></li><li><a href="https://storybook.audiokit.ai">AudioKit</a></li></ul>
	<p>Stories use made-up data only.</p>
</main>`
};

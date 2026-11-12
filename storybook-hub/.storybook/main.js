// The Epsilon Storybook hub at storybook.epsilonrecords.com (shared 0064–0066): a welcome page,
// then each product's published Storybook in one sidebar (Storybook composition). Each product
// must send Access-Control-Allow-Origin for this origin. Add AudioKit once storybook.audiokit.ai
// is live: a ref to an address that doesn't answer shows an error in the sidebar.
/** @type {import('@storybook/html-vite').StorybookConfig} */
export default {
	stories: ['../stories/*.stories.js'],
	framework: { name: '@storybook/html-vite', options: {} },
	refs: {
		labelkit: { title: 'LabelKit', url: 'https://storybook.labelkit.co' }
	}
};

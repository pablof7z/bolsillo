import { defineConfig } from 'jsrepo';

export default defineConfig({
    // configure where stuff comes from here
    registries: ['https://ndk.fyi/registry'],
    // configure where stuff goes here
    paths: {
		blocks: 'src/lib/components/blocks',
		builders: 'src/lib/components/builders',
		components: 'src/lib/components',
		icons: 'src/lib/components/icons',
		ui: 'src/lib/components/ui',
		utils: 'src/lib/utils'
	},
});
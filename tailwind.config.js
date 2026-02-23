/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			fontFamily: {
				sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
				mono: ['JetBrains Mono', 'Fira Code', 'monospace']
			},
			colors: {
				surface: {
					DEFAULT: '#18181b',
					hover: '#1f1f23',
					active: '#27272a'
				}
			},
			animation: {
				'fade-in': 'fadeIn 300ms ease-out',
				'slide-up': 'slideUp 300ms ease-out',
				'pulse-subtle': 'pulseSubtle 2s ease-in-out infinite'
			},
			keyframes: {
				fadeIn: {
					'0%': { opacity: '0' },
					'100%': { opacity: '1' }
				},
				slideUp: {
					'0%': { opacity: '0', transform: 'translateY(8px)' },
					'100%': { opacity: '1', transform: 'translateY(0)' }
				},
				pulseSubtle: {
					'0%, 100%': { opacity: '1' },
					'50%': { opacity: '0.7' }
				}
			}
		}
	},
	plugins: []
};

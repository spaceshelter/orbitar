import {ThemeCollection} from './Theme/ThemeProvider';

const theme: ThemeCollection = {
    light: {
        colors: {
            bg: '#ffffff',
            fg: '#000000',

            'sidebar-bg': 'rgb(255, 255, 255, 0.7)',

            'text-fg': 'rgba(0, 0, 0, 0.8)',

            'active-fg': '#3992E4',
            'negative-fg': '#ED6158',
            'inactive-fg': 'rgba(0, 0, 0, 0.3)',
            'disabled-fg': 'rgba(0, 0, 0, 0.15)',

            'link-fg': '#3992E4',
            'link-hover-fg': '#3384CE',

            'answer-line-fg': 'rgba(0, 0, 0, 0.1)',

            'input-bg': 'rgba(0, 0, 0, 0.1)',

            'button-bg': 'rgba(57, 146, 228, 1)',
            'button-fg': '#ffffff',
            'button-dis-bg': 'rgba(0, 0, 0, 0.1)',
            'button-dis-fg': 'rgba(0, 0, 0, 0.38)',
            'button-hover-bg': '#3384CE',

            'rating-list-border': 'rgba(0, 0, 0, 0.2)',
            'rating-list-votes-bg': 'rgba(0, 0, 0, 0.03)',

            topbar: {
                fg: '#3992E4',
                bg: 'rgba(255, 255, 255, 0.5)',
                'logo-fg': '#dcb5d1',
                button: {
                    fg: 'rgba(0, 0, 0, 0.6)',
                    active: {
                        fg: '#3992E4'
                    },
                    hover: {
                        bg: '#4f4552',
                        fg: '#ebd7da',
                    },
                },
                notify: {
                    bg: '#ea3434',
                    fg: '#000000'
                },
                karma: {
                    bg: '#9b9295',
                    fg: '#3c363f'
                }
            },
            rating: {
                border: '#c1c1c1',
                bg: '#f1eff4',
                button: {
                    fg: '#7b7b7b',
                    bg: '#c1c1c1',
                },
                plus: {
                    fg: '#4e8144',
                    bg: '#95d2ae',
                },
                minus: {
                    fg: '#ad0000',
                    bg: '#e27e97',
                },
            },
            item: {
                bg: 'transparent',
            },
            controls: {
                bg: 'transparent',
            },
            irony: {
                fg: '#ff0000',
            },
            blockquote : {
                bg: 'rgba(0,0,0,0.03)',
            },
            username: {
                fg: '#841515',
            },
            comment: {
                'new-border': '#7692ff',
            },
            subscribe: {
                bg: '#9fbdcb',
                fg: '#474e6a',
                un: {
                    bg: '#279db9',
                    fg: '#000000',
                }
            }
        },
    },
    dark: {
        colors: {
            bg: '#2B2A2A',
            fg: '#ffffff',

            'sidebar-bg': 'rgb(43, 42, 42, 0.7)',

            'text-fg': 'rgba(255, 255, 255, 0.8)',

            'active-fg': '#58A8BA',
            'negative-fg': '#BA5E58',
            'inactive-fg': 'rgba(255, 255, 255, 0.3)',
            'disabled-fg': 'rgba(255, 255, 255, 0.1)',

            'link-fg': '#58A8BA',
            'link-hover-fg': '#68B1C1',

            'answer-line-fg': 'rgba(255, 255, 255, 0.1)',

            'input-bg': 'rgba(0, 0, 0, 0.2)',

            'button-bg': 'rgba(88, 168, 186, 1)',
            'button-fg': '#ffffff',
            'button-dis-bg': 'rgba(255, 255, 255, 0.1)',
            'button-dis-fg': 'rgba(255, 255, 255, 0.38)',
            'button-hover-bg': '#68B1C1',

            'rating-list-border': 'rgba(255, 255, 255, 0.2)',
            'rating-list-votes-bg': 'rgba(255, 255, 255, 0.03)',

            topbar: {
                fg: '#58A8BA',
                bg: 'rgba(43, 42, 42, 0.6)',
                logo: {
                    fg: '#8b4977',
                },
                button: {
                    fg: 'rgba(255, 255, 255, 0.6)',
                    active: {
                        fg: '#58A8BA'
                    },
                    hover: {
                        bg: '#5f3e68',
                        fg: '#ed7285',
                    }
                },
                notify: {
                    bg: '#ea3434',
                    fg: '#ffffff'
                },
                karma: {
                    bg: '#bc5880',
                    fg: '#100917'
                }
            },
            rating: {
                fg: 'rgba(255, 255, 255, 0.6)',
                plus: {
                    fg: '#58A8BA',
                },
                minus: {
                    fg: '#BA5E58',
                },
                dis: {
                    fg: 'rgba(255, 255, 255, 0.2)',
                }
            },
            item: {
                bg: 'transparent',
            },
            controls: {
                bg: 'transparent',
            },
            irony: {
                fg: '#fa8e8e',
            },
            blockquote : {
                bg: 'rgba(255,255,255,0.03)',
            },
            username: {
                fg: '#ee7285',
            },
            comment: {
                'new-border': '#732a53',
            },
            subscribe: {
                bg: '#3c1681',
                fg: '#8894c8',
                un: {
                    bg: '#ffeeff',
                    fg: '#000000',
                }
            }
        },
    },
};

export default theme;

import {ThemeCollection} from './Theme/ThemeProvider';

/**

Each theme is defined using key colors

- fg             body text color
- bg             main background
- primary        main accent color
- danger         accent fo negative/dangerous things
- positive       accent for positive things
- link
- linkVisited
- shadow         shadows for elevated elements
- glass          semi-transparent background

All other color variants are generated automatically (if not defined manually)
preview of all theme colors is available at http://orbitar.local/theme


*/

export const themes: ThemeCollection = {
    debugTheme: {
        colors: {
            fg: 'rgba(255,255,255,0.8)',//text color
            primary: '#7aba58',// primary accent for important things
            primaryHover: '#9bd57d',
            danger: '#BA5E58',// accent fo negative/dangerous things
            dangerHover: '#ff8980',
            positive: '#74b65e', // accent for positive things
            link: '#7aba58',// links
            linkVisited: '#7aba58',
            linkHover: '#9bd57d',
            bg: '#102f2f',// background
            shadow: 'rgba(0,0,0,0.15)',// shadows for elevated elements
            glass: 'rgba(16,42,39,0.7)',// semi-transparent background


            // ALL COLORS BELOW ARE DEPRECATED
            'sidebar-bg': '#663355',
            'text-fg': '#663355',
            'active-fg': '#663355',
            'negative-fg': '#663355',
            'inactive-fg': '#663355',
            'disabled-fg': '#663355',
            'link-fg': '#663355',
            'link-hover-fg': '#663355',
            'answer-line-fg': '#663355',
            'input-bg': '#663355',
            'button-bg': '#663355',
            'button-fg': '#663355',
            'button-dis-bg': '#663355',
            'button-dis-fg': '#663355',
            'button-hover-bg': '#663355',
            'rating-list-border': '#663355',
            'rating-list-votes-bg': '#663355',
            'scrollbar-track-bg': '#663355',

            topbar: {
                fg:  '#663355',
                bg:  '#663355',
                border:  '#663355',
                'logo-fg':  '#663355',
                button: {
                    fg:  '#663355',
                    active: {
                        fg:  '#663355',
                    },
                    hover: {
                        bg: '#663355',
                        fg:  '#663355',
                    },
                },
                notify: {
                    bg:  '#663355',
                    fg:  '#663355',
                },
                karma: {
                    bg:  '#663355',
                    fg:  '#663355',
                }
            },
            rating: {
                border:  '#663355',
                bg:  '#663355',
                button: {
                    fg:  '#663355',
                    bg:  '#663355',
                },
                plus: {
                    fg:  '#663355',
                    bg: '#663355',
                },
                minus: {
                    fg:  '#663355',
                    bg: '#663355',
                },
            },
            item: {
                bg: '#663355',
            },
            controls: {
                bg: '#663355',
            },
            irony: {
                fg: '#663355',
            },
            blockquote : {
                bg: '#663355',
            },
            username: {
                fg: '#663355',
            },
            comment: {
                'new-border': '#663355',
            },
            subscribe: {
                bg: '#663355',
                fg: '#663355',
                un: {
                    bg: '#663355',
                    fg: '#663355',
                }
            }


        },
    },
    light: {
        colors: {
            fg: 'rgba(0,0,0,0.76)',//text color
            bg: '#fefefe',// background
            primary: '#4d94de', // primary accent for important
            danger: '#ED6158',// accent fo negative/dangerous things
            dangerHover: '#ce4c42',
            positive: '#74b65e', // accent for positive things
            positiveHover: '#559742',
            link: '#4d94de',// links
            linkVisited: '#4d94de',
            linkHover: '#2a74bd',
            shadow: 'rgba(0,0,0,0.15)',// shadows for elevated elements
            glass: 'rgba(255,255,255,0.7)',// semi-transparent background


            // ALL COLORS BELOW ARE DEPRECATED
            'sidebar-bg': 'rgb(255, 255, 255, 0.7)',
            'text-fg': 'rgba(0, 0, 0, 0.8)',
            'active-fg': '#3992E4',
            'negative-fg': '#ED6158',
            'inactive-fg': 'rgba(0, 0, 0, 0.5)',
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
            'scrollbar-track-bg': '#d9d9d9',
            'popup-bg': '#ffffff',
            'notification-date-fg': 'rgba(0, 0, 0, 0.6)',
            'notification-text-fg': 'rgba(0, 0, 0, 0.8)',
            'notification-delimiter-fg': 'rgba(0, 0, 0, 0.12)',

            'highlight-bg': 'rgba(0, 0, 0, 0.03)',

            topbar: {
                fg: '#3992E4',
                bg: 'rgba(255, 255, 255, 0.8)',
                border: 'rgba(0, 0, 0, 0.1)',
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
            fg: 'rgba(255,255,255,0.8)',
            primary: '#58A8BA',
            primaryHover: '#51b7cb',
            danger: '#BA5E58',
            dangerHover: '#ff8980',
            positive: '#74b65e',
            link: '#58A8BA',
            linkVisited: '#58A8BA',
            linkHover: '#53c6de',
            bg: '#2A2A2A',
            //lowered: 'rgba(0,0,0,0.2)',
            shadow: 'rgba(0,0,0,0.15)',
            glass: 'rgba(33,33,33,0.7)',

            // ALL COLORS BELOW ARE DEPRECATED

            'sidebar-bg': 'rgb(43, 42, 42, 0.7)',
            'text-fg': 'rgba(255, 255, 255, 0.8)',
            'active-fg': '#58A8BA',
            'negative-fg': '#BA5E58',
            'inactive-fg': 'rgba(255, 255, 255, 0.3)',
            'disabled-fg': 'rgba(255, 255, 255, 0.1)',
            'link-fg': '#58A8BA',
            'link-hover-fg': '#68B1C1',
            'answer-line-fg': 'rgba(255, 255, 255, 0.05)',
            'input-bg': 'rgba(0, 0, 0, 0.2)',
            'button-bg': 'rgba(88, 168, 186, 1)',
            'button-fg': '#ffffff',
            'button-dis-bg': 'rgba(255, 255, 255, 0.1)',
            'button-dis-fg': 'rgba(255, 255, 255, 0.38)',
            'button-hover-bg': '#68B1C1',
            'rating-list-border': 'rgba(255, 255, 255, 0.2)',
            'rating-list-votes-bg': 'rgba(255, 255, 255, 0.03)',
            'scrollbar-track-bg': '#535353',
            'popup-bg': '#363636',
            'notification-date-fg': 'rgba(255, 255, 255, 0.6)',
            'notification-text-fg': 'rgba(255, 255, 255, 0.8)',
            'notification-delimiter-fg': 'rgba(255, 255, 255, 0.12)',
            'highlight-bg': 'rgba(255, 255, 255, 0.03)',

            topbar: {
                fg: '#58A8BA',
                bg: 'rgba(36, 36, 36, 0.8)',
                border: 'rgba(0, 0, 0, 0.1)',
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
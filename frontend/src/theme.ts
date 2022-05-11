import {ThemeCollection} from './Theme/ThemeProvider';

const theme: ThemeCollection = {
    debugTheme: {
        colors: {
            // foreground (text colors and more)
            fgHardest: '#ffffff',
            fgHarder: 'rgba(255,255,255,0.9)',
            fgHard: 'rgba(255,255,255,0.8)',
            fg: 'rgba(255,255,255,0.7)',
            fgMedium: 'rgba(255,255,255,0.65)',
            fgSoft: 'rgba(255,255,255,0.6)',
            fgSofter: 'rgba(255,255,255,0.45)',
            fgSoftest: 'rgba(255,255,255,0.3)',
            fgGhost: 'rgba(255,255,255,0.2)',
            fgAlmostInvisible: 'rgba(255,255,255,0.1)',

            // primary accent
            primary: '#58A8BA',
            primaryHover: '#45d3f8',
            primaryGhost: 'rgba(88,168,186,0.3)',

            // accent fo negative/dangerous things
            danger: '#BA5E58',
            dangerHover: '#ff8980',
            dangerGhost: 'rgba(186,94,88,0.3)',

            // accent for positive things
            positive: '#74b65e',
            positiveHover: '#74b65e',
            positiveGhost: 'rgba(116,182,94,0.3)',

            // links
            link: '#e229ac',
            linkHover: '#e229ac',
            linkVisited: '#e229ac',
            linkGhost: 'rgba(68,164,255,0.3)',

            // background
            bg: '#031c2b',

            //background modification
            dim1: 'rgba(255,255,255,0.03)',
            dim2: 'rgba(255,255,255,0.06)',
            dim3: 'rgba(255,255,255,0.12)',

            // Shadows for elevated elements
            shadow: 'rgba(0,0,0,0.3)',

            // semi-transparent background
            glass: 'rgba(3,28,43,0.7)',

            // rise1: 'rgba(0,0,0,0.5)',
            // brighten1: 'rgba(255,255,255,0.06)',
            // brighten2: 'rgba(255,255,255,0.12)',


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
            // foreground (text colors and more)

            fgHardest: '#000000',
            fgHarder: 'rgba(0,0,0,0.9)',
            fgHard: 'rgba(0,0,0,0.8)',
            fg: 'rgba(0,0,0,0.7)',
            fgMedium: 'rgba(0,0,0,0.65)',
            fgSoft: 'rgba(0,0,0,0.6)',
            fgSofter: 'rgba(0,0,0,0.45)',
            fgSoftest: 'rgba(0,0,0,0.3)',
            fgGhost: 'rgba(0,0,0,0.2)',
            fgAlmostInvisible: 'rgba(0,0,0,0.1)',


            // primary accent
            primary: '#3992E4',
            primaryHover: '#4aabff',
            primaryGhost: 'rgba(74,171,255,0.3)',

            // accent fo negative/dangerous things
            danger: '#ED6158',
            dangerHover: '#ff8980',
            dangerGhost: 'rgba(255,137,128,0.3)',

            // accent for positive things
            positive: '#74b65e',
            positiveHover: '#74b65e',
            positiveGhost: 'rgba(116,182,94,0.3)',

            // links
            link: '#44a4ff',
            linkVisited: '#44a4ff',
            linkHover: '#2a74bd',
            linkGhost: 'rgba(68,164,255,0.3)',

            // background
            bg: '#ffffff',

            //background modification
            dim1: 'rgba(0,0,0,0.03)',
            dim2: 'rgba(0,0,0,0.06)',
            dim3: 'rgba(0,0,0,0.12)',

            // Shadows for elevated elements
            shadow: '#000000',

            // semi-transparent background
            glass: 'rgba(255,255,255,0.7)',


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
            // foreground (text colors and more)
            fgHardest: '#ffffff',
            fgHarder: 'rgba(255,255,255,0.9)',
            fgHard: 'rgba(255,255,255,0.85)',
            fg: 'rgba(255,255,255,0.8)',
            fgMedium: 'rgba(255,255,255,0.7)',
            fgSoft: 'rgba(255,255,255,0.6)',
            fgSofter: 'rgba(255,255,255,0.5)',
            fgSoftest: 'rgba(255,255,255,0.4)',
            fgGhost: 'rgba(255,255,255,0.3)',

            // primary accent
            primary: '#58A8BA',
            primaryHover: '#45d3f8',
            primaryGhost: 'rgba(88,168,186,0.3)',

            // accent fo negative/dangerous things
            danger: '#BA5E58',
            dangerHover: '#ff8980',
            dangerGhost: 'rgba(186,94,88,0.3)',

            // accent for positive things
            positive: '#74b65e',
            positiveHover: '#74b65e',
            positiveGhost: 'rgba(116,182,94,0.3)',

            // links
            link: '#58A8BA',
            linkVisited: '#58A8BA',
            linkHover: '#4fb0c6',
            linkGhost: 'rgba(68,164,255,0.3)',

            // background
            bg: '#2A2A2A',

            //background modification
            dim1: 'rgba(255,255,255,0.03)',
            dim2: 'rgba(255,255,255,0.06)',
            dim3: 'rgba(255,255,255,0.12)',

            // Shadows for elevated elements
            shadow: 'rgba(0,0,0,0.1)',

            // semi-transparent background
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

export default theme;

import {ThemeCollection} from './Theme/ThemeProvider';

const theme: ThemeCollection = {
    light: {
        colors: {
            bg: '#d7d7de',
            fg: '#000000',
            topbar: {
                bg: '#3c363f',
                'logo-fg': '#dcb5d1',
                button: {
                    fg: '#9b9295',
                    hover: {
                        bg: '#4f4552',
                        fg: '#ebd7da',
                    },
                },
                notify: {
                    bg: '#ea3434',
                    fg: '#ffffff'
                },
                karma: {
                    bg: '#9b9295',
                    fg: '#3c363f'
                }
            },
            sidebar: {
                bg: '#cacad2',
                fg: '#000000',
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
                bg: '#ffffff',
            },
            controls: {
                bg: '#f1eff4',
            },
            link: {
                fg: '#bd308b',
            },
            irony: {
                fg: '#ff0000',
            },
            username: {
                fg: '#841515',
            },
            input: {
                bg: '#ebe6ef',
                fg: '#000000',
                border: '#d7cadd',
                'focus-outline': '#af9db7',
            },
            button: {
                bg: '#625767',
                border: '#625767',
                fg: '#ffffff',
                dis: {
                    bg: '#baacba',
                    border: '#baacba',
                    fg: '#796b79',
                }
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
            bg: '#1a142a',
            fg: '#cfc5dc',
            topbar: {
                bg: '#100917',
                logo: {
                    fg: '#8b4977',
                },
                button: {
                    fg: '#bc5880',
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
            sidebar: {
                bg: '#1e162f',
                fg: '#cfc5dc',
            },
            rating: {
                border: '#1b142a',
                bg: '#0b070f',
                button: {
                    fg: '#7b7b7b',
                    bg: '#1b142a',
                },
                plus: {
                    fg: '#8aff74',
                    bg: '#1b3f2a',
                },
                minus: {
                    fg: '#ff74ba',
                    bg: '#67303e',
                },
            },
            item: {
                bg: '#100917',
            },
            controls: {
                bg: '#0b070f',
            },
            link: {
                fg: '#d98ec5',
            },
            irony: {
                fg: '#fa8e8e',
            },
            username: {
                fg: '#ee7285',
            },
            input: {
                bg: '#2a162f',
                fg: '#cfc5dc',
                border: '#422450',
                'focus-outline': '#9d65b7',
            },
            button: {
                bg: '#4d204d',
                border: '#4c1952',
                fg: '#ccb5c7',
                dis: {
                    bg: '#3f283f',
                    border: '#36213a',
                    fg: '#5e4957',
                }
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

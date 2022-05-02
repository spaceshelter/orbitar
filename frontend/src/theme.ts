import {ThemeCollection} from './Theme/ThemeProvider';

const theme: ThemeCollection = {
    light: {
        colors: {
            bg: '#ffffff',
            fg: '#000000',

            'active-fg': '#3992E4',
            'negative-fg': '#ED6158',
            'inactive-fg': 'rgba(0, 0, 0, 0.4)',
            'disabled-fg': 'rgba(0, 0, 0, 0.2)',

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
            sidebar: {
                bg: '#ffffff',
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
                bg: 'transparent',
            },
            controls: {
                bg: 'transparent',
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
            bg: '#2B2A2A',
            fg: '#cfc5dc',

            'active-fg': '#58A8BA',
            'negative-fg': '#BA5E58',
            'inactive-fg': 'rgba(255, 255, 255, 0.6)',
            'disabled-fg': 'rgba(255, 255, 255, 0.2)',

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
            sidebar: {
                bg: '#1e162f',
                fg: '#cfc5dc',
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

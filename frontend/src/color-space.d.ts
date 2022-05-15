declare module 'color-space' {
    export type Colorspace = {
        name: string;
        min: [number, number, number];
        max: [number, number, number];
        channel: [string, string, string];
        alias: string[];
    };

    export type RGBColorspace = Colorspace & {
        hsl(rgb: [number, number, number, number?]): [number, number, number];
    };

    export type HSLColorspace = Colorspace & {
        rgb(hsl: [number, number, number, number?]): [number, number, number];
    };

    export const rgb: RGBColorspace;
    export const hsl: HSLColorspace;
}

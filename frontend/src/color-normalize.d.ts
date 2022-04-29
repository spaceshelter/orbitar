declare module 'color-normalize' {
    function rgba(value: string | Uint8Array | Uint8ClampedArray | number[], type?: 'array' | 'uint8' | 'uint8_clamped'): number[];
    export = rgba;
}

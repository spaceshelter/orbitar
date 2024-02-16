import { layers } from './layers';
import { createCanvas } from 'canvas';

const layersImg = layers.map(layer => layer.map(bob64 => {
    let img = new Image();
    img.src = 'data:image/png;base64,' + bob64;
    return img;
}));

const m = 0x80000000; // 2^31
const rand31 = () => Math.floor(Math.random() * (m-1));
const rng = (seed) => {
    // LCG constants
    const a = 1103515245;
    const c = 12345;
    let state = seed ? seed : rand31();

    const nextInt = () => {
        state = (a * state + c) % m;
        return state;
    }
    const nextFloat = () => {
        // We know that result of next() will be 0 to 0x7fffffff (inclusive).
        return nextInt() / (m - 1);
    }
    return (n) => Math.floor(nextFloat() * n);
}

const draw = (version, seed) => {
    let v;
    switch (version) {
        case 1:
            v = [12, 19, 22, 23, 19];
            break;
        default:
            return null;
    }
    const canvas = createCanvas(16, 16);
    const ctx = canvas.getContext('2d');
    ctx.antialias = 'none';
    ctx.imageSmoothingEnabled = false;
    if (seed === 0) {
        ctx.drawImage(layersImg[0][0], 0, 0);
    } else {
        const randn = rng(seed);
        layersImg.forEach((layer, i) => {
            const k = randn(v[i]);
            ctx.drawImage(layer[k], 0, 0);
        });
    }
    return canvas.toDataURL();
}

export { draw, rng, rand31 };

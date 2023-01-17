import {aesDecryptFromBase64, aesEncryptToBase64, base62decodeToHex, charToB62Int, decryptMetadata} from '../../src/parser/CryptoUtils';

test('aes encode decode', () => {
    const key = 'mVRW8ycqHYZQSgYcBN8PUz8hVRWB5n5q';
    expect(aesDecryptFromBase64(aesEncryptToBase64('test', key), key)).toBe('test');
    expect(aesDecryptFromBase64('TGBv/lDGJdJo9SK8kDxiaEnu3i9dFxUhl5pDJVDzCG8=', key)).toBe('test');
});

test('wrong input', () => {
    const key = 'mVRW8ycqHYZQSgYcBN8PUz8hVRWB5n5q';
    expect(aesDecryptFromBase64(aesEncryptToBase64('test', key), key + '1')).toBe('');
    expect(aesDecryptFromBase64('a' + aesEncryptToBase64('test', key), key)).toBe('');
    expect(aesDecryptFromBase64('TGBv/lDGJdJo9SK8kDxiaEnu4i9dFxUhl5pDJVDzCG8=', key)).toBe('');
});

test('ransdom input', () => {
    const key = 'mVRW8ycqHYZQSgYcBN8PUz8hVRWB5n5q';
    // try length 1 to 10
    for (let l = 1; l < 10; l++) {
        // 10 tries
        for (let i = 0; i < 10; i++) {
            // generate random string
            let s = '';
            for (let i = 0; i < l; i++) {
                s += String.fromCharCode(Math.floor(Math.random() * 256));
            }
            expect(aesDecryptFromBase64(aesEncryptToBase64(s, key), key)).toBe(s);
        }
    }
});

const BASE62_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

test('base62 chars decode', () => {
    for (let i = 0; i < BASE62_CHARS.length; i++) {
        expect(charToB62Int(BASE62_CHARS[i])).toBe(i);
    }
});

test('invalid base62 chars', () => {
    expect(() => charToB62Int('!')).toThrow();
    expect(() => charToB62Int('-')).toThrow();
    expect(() => charToB62Int('+')).toThrow();
    expect(() => charToB62Int('=')).toThrow();
});

test('base62 decode', () => {
    expect(base62decodeToHex([1, 38, 40, 13, 9, 4, 35, 2, 19, 38, 50, 22, 44, 0].map(i => BASE62_CHARS[i]).join('')))
        .toEqual('44c30fc584462ebcba70');

    expect(base62decodeToHex('3421h432h4lhj2k1h4j213h42lhafhajl'))
        .toEqual('11c164bfadd5ceeefe3ae43e3961e9e2f6051bc42fc509e9d');

    expect(base62decodeToHex('0'))
        .toEqual('0');

    expect(base62decodeToHex(''))
        .toEqual('0');

    expect(base62decodeToHex(BASE62_CHARS))
        .toEqual('275c6d5b5030a95f2eda46451477a8afc33d53def6702922e039f76821c475dfcb0672f48096d2efd511d1a131');

    expect(() => base62decodeToHex('.')).toThrow();
});

const key1 = 'k7DG2CekzdUfckbr7ay9PESLvDPBQf9S';
const key2 = 'CpLS5EnQvHZhtVERKbpRgvdK29n9QfFF';

test('metadata decrypt', () => {
    // NOTE: random keys! don't use them for anything else!

    expect(decryptMetadata('2CiRWwVrzEqaYAToTaqbFXaDKt1fFbpOG3', key1))
        .toEqual('hello, orbitar!');

    expect(decryptMetadata('2BOUZ1WehczYr1L7X1JwmTDB9bfc2tu40J', key1))
        .toEqual('123:456:jpg');

    // incorrect (modified) input
    expect(decryptMetadata('2BOUZ1WehczYr1L8X1JwmTDB9bfc2tu40J', key1))
        .toEqual('');

    expect(decryptMetadata('2BY0popFxtAKqmPYTUxMfJS6wYd2jXXVdI', key2))
        .toEqual('');

    expect(decryptMetadata('2BY0popFxtAKqmPY', key2))
        .toEqual('');

    // too short
    expect(() => decryptMetadata('2BY0po', key2))
        .toThrow();

    // wrong key1 length
    expect(() => decryptMetadata('2BY0popFxtAKqmPYTUxMfJS6wYd2jXXVdI', key2 + '!'))
        .toThrow();
});

test('zero IV', () => {
    expect(decryptMetadata('2C74fGYjJwALtHdChASi4cfJtjjhqwv8gS', key1))
        .toEqual('123:456:jpg');

    expect(decryptMetadata('2DpeuqAiRE2NVPdxbHMDdOlCYsNXaXgIa0', key2))
        .toEqual('123:456:jpg');
});

test('metadata decrypt3', () => {
    const encStrings = ['2BOMrjrUtcB4lz9svfsHxo9MVthj11lThe', '2E3h8qEMJ7hSbcwPVeMMkP45dw3y15L8kc',
        '2DQvO7bIlEGpNPLYQLwdzpI2ZXDMHwrFLg', '2BY9JdBqTpDiZNbJalifwQWNbuQCBWSu7N', '2CVIuf3tNIxYhtohTUi952OQpnN4aBW7kx',
        '2BuF6GaRvGcEvsP796yVYyaKEu6mSH3JGZ', '2DMTZSX5svtfyynmr04Y2UKFdntzqrNRnW', '2CE8DVwOdYtte3uy8Hzmf2B5gMlHmQGSmH',
        '2BlkJSeB1pmuk2PvVKpo14NPq6IVuDt9tR', '2CrJkqMh9H50ZJw989UglWK1kauMG8f5oj', '2DKkTNqZ9v2xj0S2nF0AUwJmvuH1UrHbcM',
        '2C17BBFhSqKr9kPe1vspEl8frq4LopiW7h', '2DprctjyoHgP6ObCjhQS87ZE5qBBKXdh6r', '2C6j7QoWKbLA4PsaYZB3IRSUhCIe0czfix',
        '2Dp5C2YeegULOmagGKerubs3qUADoDNtDk', '2BoIpY0J7GX6Ahd7JGvPhQovau6dndKeDK', '2BOonyQZTeXyenEhKKfbSYI364uIiRzYkf',
        '2DxsdpOaqu2LUoou6y03zVydfEfoNlYmot', '2Du3diSZyiFFZCnQjPJDtPI0mzgorYAkbr', '2Df2eeOBZuTOyotfuW7WQOekXOvJ8z5dIP',
        '2CIq6vDe1Bn8j9pTLYU7TGu2Oczd0Rth3H', '2D350tzoyfpK871OAEe89rgNHX6riEK4wJ', '2CY2ph0OUaxptmU1DyH8LOiG8yAvOwAqr2',
        '2DY0XbmUACNPOLELTsHJzNbGyy4Lf7BjV4', '2Dcz4PumvnSfaqVSp7pX8CkXpQT1iZdaLx', '2BXi5HNMCldaTcePy2k9waJlUa8HMeAiR7',
        '2BMPT5XJRsPf4hwkoEuutX3lMhG15UtmAS', '2DSLx8ycs3XToqGTLAxXGZbCrTNZVqFG7Y', '2DR14tUcPunDy1PZyxEU7RqYSeSdrCMeZu',
        '2CCskfWGMbbKKxq0bLcvdgel0KQMUVygDR', '2Cp8pJdisRGZV1iKHfVQq1IQSgAhlBaHSo', '2DAp9BYjCyfxLg7IYdjR4R7ehZfyB37QZV',
        '2CKXao3ognli0q7oRz4e7BeqEuHRpTTvtD', '2CA0K7sMUfcMcIMbn88Wz3OP9vNYobewMx', '2BXKF8ZRQSOry8N4E4OqhxXwzYv7OWSeTA',
        '2DJGiDAWUhhCWh7Qf4dcmRAPuCqnO2MFEQ', '2DyUM1Ud605wT2y2YowOiFZuOIFgSN6ZBS', '2Dtym3uf4inJUElCrDbtpOs5JNSjk6MsPb',
        '2DE9wdXjpuFbQ13f7QtMzACwTgb5xykNNK', '2DH3PrMHys4fU7U0RnroOWMTZo40wRmzsg', '2DHEM1FFsln7RaTrPfM1VcvEa2ggJ5IaAS',
        '2Dd69Tyw74q5I7mjmgdQBLQt68QBRCEO8X', '2DXYIBONe20w1UOMB0Nt3LRVZudz3lvMeh', '2CR093f8A9GibR3Sqn5M5TTqC5Ez5DhoC1',
        '2CFjoo0bgMAzjCAQ8QyYNRL6V14ngmwoUk', '2CPWWla5DiL3JObBJ5lQ8rfluN4OuUHA81', '2DosPltGpPmX71mxyQbLloVpUU2to1sYD0',
        '2C1gPGD3NwIb19eGBaCVSJuFvs0lbL7Ytp', '2CAEvDA3yw1bO76bsLSpcJSp8M25LYDpLB', '2CKlNHx0EcoGNxdqk5m1cRt9LK7AZo2xyP',
        '2C5mbkY5x8IkCI4mxLu0R3im2D0RF2Oiee', '2CR4Rxo35Sk6dNE8VBqHilIUk87s7xH9J4', '2BxASsWHKNon6avnyyHVv77jloaits2ndw',
        '2C0AjsaguyWxJccepE8jCa372BNmbJC0HV', '2DG0OjJqRSL7NwRpeidBDVbkxOpQhjxx54', '2DL2onQQKj1SJ5LxgcOp2vWQ8gZQM6MM8k',
        '2DqUPAcVZMyFrJFLRgifNXO6iBpW765zvy', '2DW0Csew3YCRqOXK29KZmu7Em7iaQpG6e2', '2Cv68aiaQZn1rXKL3MzYjSIvdMFoBG001X',
        '2Dvkg8FeW8iRuEqOCfvU6LkDZxgvJQFLe5', '2DcGUItkY5snu47KcI4KaPtbzteUCpVVax', '2DaPS6tcbV7Yzo6yNPDecVR8d9w8b0afww',
        '2CuA2m9Pi4xF6g1rLQ5noz0B0meIxNSFDB', '2Cy7hUwQPGBlTEjI7InS0KKGkhhxU1MamK', '2DFZZko73OfOLzwGGfJxFSPBKiIiQ63IRG',
        '2Cgpi7AHHooFFPobjMJov9GcVHeqcnxjrE', '2DkoEOb5ku3GZrTtOb6bNpHtyNDOb5GInX', '2CRlBX8wCd82hxA0RGDjs0bgHskqAH0qm3',
        '2BsOfqInEZbj5465l7BKHWWnst8J215DVK', '2C0Cdlviz9TmHffzz1ecPOBUwemfH0RyjK', '2D1O5ClDcQZYlUB0yCOsY7VQxqs8wQOOB0',
        '2DPXayOZMXPn5azdwoi0ASEDYTVTeP4EL6', '2CXApnnGRFZlkuJerlriVwKuIPxLGMH6Al', '2BZs47usufmLj4nKwQFNN2px7d196o2ESe',
        '2DOz5wT8P0vnsNIOMWHUoiGIY1mgJkuQVL', '2E2OYKYWr2qcCwCo4R0C3OoHjuqCchbpjD', '2BpqVfGJRINl8Y1diRfNdieqrxe2hLeJPB',
        '2CtnYnC4ESY1v3W68lBVB8uZblRtOxc35n', '2CdKQgGGM4Du6s7HPAOm9qoBZ29mtEOl0f', '2CgN8ZDRC4lu4FN20lLOkwa8J0N6JMvP7f',
        '2E4YBuSPZxsegOwyAqAsIwvj0r9uio62Pu', '2BT111UoJKMKz5hFrYBi5KIhQidfHh8LNj', '2ByTAQSoXRkOz66wk0i0JUe7tyzyphYr5s',
        '2CqHgJ86ZT55LSlw2vfgZwyAXeoY24ZsPJ', '2DlAlCKz26glno8AvaaxQfDiHFJyRgj993', '2CpFnEPbocm1J8TK3fVyTNhKUA2V9ROrCH',
        '2DVgvUhhff1jXRUt57xs9LVr1XusNsH7xW', '2Bi3ufliLJHyVcMeLdEVmtBX3rNofwI3P1', '2CkaQ2rOnq3B0zEVW4qTUYm7EOd3hCdF12',
        '2BoB2rtavYrRDlYwGPvuqYWhx2GEIAdNbP', '2CeRRdfSoh3Fd2k81zqNf5uVqbntb1wzIC', '2DpMcFpaik2UrzN7eGQBd4B1VrpVnl3GHR',
        '2DIEcgg02d7RI8mmw49LKzaotFrY9nr0jj', '2D8X2wyBFe4ZiTnqA1cXr4B7yvzlCx91fc', '2CiF4BE1jpD9pnY23ncCdugOio3pfm9S6c',
        '2CnXBbZR4eNIO1Vv5iCcVrt6mWwa7cTIjK', '2BwPSEqUZ4nCsEZfEFRBVodCScyMqcqqaL', '2DIAkYNA9zpgsDdVnIojWgoRUs8tmKUgZA',
        '2Ba1Fa67m6XT4B3QwKgGSkI9QpuQ0bEYsy', '2CKkUCqaifj5O9Fdsh1Xg9oTviZvdxswj1'];

    for (const s of encStrings) {
        expect(decryptMetadata(s, key1))
            .toEqual('123:456:jpg');
    }
});

test('metadata decrypt3', () => {
    const encStrings = [
        '2CfoiJElWT8QjDql5KyNGhCBpVdSlBy4gU', '2Cg2ZTio8q2ekZ5hhN4eUJPQq3BxYM92Xz', '2BYYIaBqbFzkLkjC6bo4nII6E0djhQOrbZ',
        '2CgfyUUE6HrQr77voyXHWDRGEe6D6F8xvT', '2DarDB8viI051aC07b49BqQNbuFJpqQnuH', '2CAcbohPNZJjvA4RI55Pli41Y5RrMAldmn',
        '2BxkM9ofFnXv51sFXJnrtWs5Bv0Rtc94iV', '2BOplxsKy3UdPzQ9Rnx3McxNOLTHlJjvB3', '2C5UAEd8qe0bFh7W7GF1LgHaPvhkwv5BXO',
        '2CKva5YTnpvAmxyixPMbR4fxXQF7THeH1Q', '2D36k6tUBwSHRhiY8IIxdrjvwCiCrFg7In', '2DlzkZERmXcev76Br9ppHUqr59zXNreh86',
        '2BnO4Fk5JyWUIdY7fwpKSYCSjfuteZ52Id', '2Duv4pAWj6gxzTxDyGnoMbs3m6lL5UrfBS', '2DUGDSz9Zx8sLmmWh9a9owtEbA2bYh6ZPH',
        '2Bkz156JG1G7zp9HOckC84aR1sveHH0Orv', '2DSQ7xaj3V45EmqSVeMTzfhs2GUg7ueHfp', '2E3G74xplNAUpCH1aXC4s1NaIX9SOr4BSz',
        '2BYOd29R8m0nGbF9imu1tfGVWlXkgEsJWF', '2DAaTNhI8dE4dbejmkn1uDHkfKXpgR7CwV', '2BMrct7VmttgKh6uffz0zk0SgDeWZtmZ02',
        '2DT8A4nJX1Gbv3yaZt5l3mbWWykqjZMwMh', '2ClFJvPpUkE1U1ZWgiVDxQPPvn2l2oLqrw', '2BfagCQJhtutNYxThLMVv5f3EfXWa4IeOU',
        '2Da6KgHBs4UHR8gWqTRjVNi9uNVoGsTGY9', '2CGP4CSF7pYSgcgFaEf2dRa2dlLMCY4WWc', '2CQYMabRxghKZa4SdWezVol0Z55FyFf320',
        '2D6kdhjX774UBFRJejqthrWAwybUOr5Eze', '2BxWYGxKh6UmtVToxsl35zjfE9bSLRmwyw', '2Ctyaxrq5SmRSsUKq2UL2EIdLb0HkKvT7L',
        '2Bmdh3TJC7dJZ79i7MVsGUSEawhuGYdaWt', '2CxuHVjedy27JuSaXIg6Xy9Pb61NS5goeY', '2Dx3NOa6bri9lAhg2O2VsNgNwudpVe680l',
        '2Bci99lBwQmehJSurDyeVT5KLsav7AKM2q', '2DyVpDChKWCUHK4neoNFA2LJYziEb3Za1W', '2BOVskoerOaZ4h0RnSO3jujlbVigx104fk',
        '2DIdeT5p74YkdLzHYfwl9FAn8SAJToZYNU', '2Cq9OpvNI2r2iJPQVJt852MiVQJjtfj3R6', '2DsIdH1YhWm861BYf71nY0RqL6i2KE6dUM',
        '2BqlTELSsGA4FgL0l8CCW4O2FbDqH9fUkE', '2Bk5sYdDR35vK68pvAE7UVwvxp0EVUOb5s', '2BWqUeSbnnci2vuGCHOMxP12hOIewnxpax',
        '2D97Cj3UHAulSdTxEvuS8nn3l5k7WPB3an', '2C8RSRqHoUFJiCb7sbR9UpRiHAyYokaImw', '2DHef7tNWDs0QGpEeg9G4txkAuHRuJ4QeC',
        '2DHYgIKlIMd9WIGO5wvlmNyCYnxBemwpNk', '2DrK0s7vE04RZJsHRk1ytAntpIIIX72oNg', '2DlgYMsOTldJP1xXa7fSkh4hPXF7RAwzgc',
        '2Be6FtMQcFpQbnH5hvk7htfUtqBfob4jgO', '2DAcyDWQgesn23tdFKC6ab7GLNKxbEqbQz', '2DN4BAvOS5b2ZuyNayDjtGQMQ9TVDgIjDv',
        '2DCYqAkj9zOxV0HvOAyVJVXPvykg7XcFEN', '2BWhXRrQal7SleBtPB5PWjz1qFhxUI9ZRU', '2DVU83BuZIpCTjOpDRWM5j7ggXt8tkHtsx',
        '2C7uWwRMmtuGBHQT1PkCrDbqeA1tkEUkUP', '2COqyVlRkQABpNKZrTslvpu5VS5dkBEAur', '2ChX6QQ5C75VP7QPV7g05AUMEhVK68JDEf',
        '2DTLeiatqheE5Xu7J3XFIpQVlSjrjXsGy2', '2C1o1JcyUPU8SyxSCZqELI2I7juKZdAg3J', '2BsXY4BInmCHA8JTiRv5Duk4Ze84BftYBy',
        '2BYvAij7SQf5KJkZzdWzbi50nPPsg3i2AK', '2E1e8hfFLwPZK4BdRyuCMztKobWCt9kTqq', '2Dphs4AWlBHC3SkJ8zgrbv6yl1olN48B0A',
        '2CyeViIZoTMh0pjyHmlOh7whsRoxx2sFM4', '2ChbZdmqZIoRvKZ1TEXfhHEx4fCGJtZWpC', '2BuKoHpOIxZBl3GKG0uPT90drxt5Dkz7Mt',
        '2CamFoGDgQUiGsdHuJj2fx87HWLMeuOl09', '2Bjt5jMOETAgcJLMgI4Yolvy9Q35F8IcRz', '2BbClEdM9sen26FeZUnAkjks3acPbnH76s',
        '2DOIoatpSFlz4YnFy2hEDNRiq1WRukp69M', '2DBNvpZ6xVez3T0iDx2Csbl4CksZ6idWco', '2Ct44PaXERF6HsgmXlOJIRIUtrbmOMf0xA',
        '2Cde8naVgszeNc3otWhMwGTJxmWVDZGlgl', '2BjOAJh8Nukr3c1iD3lYfRJxV4WsGoSOax', '2DfGv9g8ZVGSq6q2ZYyJBuR6OibSbICQrD',
        '2C1oojyTiV88yBxKVmvy9zSeC0xviPsttS', '2Di2VdigLRyn9hZ2Z8FBkyLaTGJJYJdbwT', '2DBIwQa7IPghSXDKFiRQebTNfXhzAhlsm8',
        '2Djgim7YCjVRGMvner4LOBIXgwBHGrWTqD', '2Bzzjuda6lZ3kA1hr6i3Q0HsvBLfeUi91G', '2C4u5wCVnr6vZ11vPws8EMUXZl6EYSFyrf',
        '2C8iB4U6iOeHanQfj57hAxPNznsGZ5OqHq', '2BhbX0iOsEzqXR7fYUyRAOLD9gGoFhyeA9', '2C9qH0SFigItOjT7VvA0dOGcYTiil732g7',
        '2DiAinTy9pjW6gkmydWWOaETl11RD8Q2qD', '2D2FctMTiUQE5m9HpQMJfVbVEEXN5mA4vM', '2CLmrYtXH7d8jL5vVITODOIu6OJEcy7icf',
        '2CZLDHIjl7nwCh37l4HX0M2wky51v0djur', '2D33Jg3nwe200ipV5A9YpTcqx2ImYqAUWd', '2DieCYTOHN7TJOQkCV4t0KQjE67Sk1neZv',
        '2Bht9dWZxvyx8mel2hbhMWPWiFbuJnEzhH', '2BeRPpxWaGPNoTuApF9Xsy4FbfiHMAXn2l', '2DVCF55A4cj8DiwNFSPqOULGbYytlf80wg',
        '2CYs9Th0St8vbA8J3o3r7XtWkuJUzZiqAI', '2BV08BvPn186wlIJ8emKMYYtG7ITKlGVX6', '2DLsSvE9fvHxDMbo9183ooo0iUYoOUvhhZ',
        '2CBaZ5WdlRe07nxwJeupt9Q5hQ2BPoAQTe', '2Cf6SvfUHOTiwHBrqOg0XNrihAyr80tPyF', '2CTqXAnbQDsgizXZRoRqEId4yV8wNHw6MT',
        '2DzE2ixPQ1y6PnIgLdIL8w6Dgosq9THi1K'
    ];

    for (const i in encStrings) {
        const s = encStrings[i];
        expect(decryptMetadata(s, key2))
            .toEqual(`test${i}`);
    }
});

test('metadata decrypt3', () => {
    const encStrings = [
        '2DNPGl8xfFU8F62RLS95oiqXHunxfdmPHk', '2DOCtB2c5UxbP4nWsgAhmPXIbQmPy2HWS7',
        '2DkMoDtFaIn53ecXTML232RfIt1t3c8UOb', '2D8zP6bTQq68pLBwDl0FNSFeqobxfPbfQx',
        '2DRGtmwR5cA1biOqgzAOQnBHbltjzC0KBl', '2CC5jGR6R9ws6ygO8cnZlvG8IBARrT9gFc',
        '2D5kRb3GQKnUBYcVTT2hjGmZDDlJjwVTh9', '2DNyp4mvfKo8L4DwJLpKqaU7IUWFpDCOGr',
        '2DMixYPet1jw56dQyt07X9cP7EdmRJfa8k', '2CpFy6RGDP7WsjqPHeeZCyO8wCZtA5HwAk',
        '2CLnwL7V1HDTHBWALOBCUmb4VL5LUu0DQz', '2BYAHJjFfYQ7vc9yDc1YDaeaPCHNHaCV1v',
        '2Dl1QDqLpJshPrY9BWo9cvqi8Gz4BZk9Qh', '2DB1s51GhYQ5yLs85cXjrDLve7IXtuJzxQ',
        '2C2cEN1KqQgMD1o9GIis8f8K2dz8TkDas9', '2BWo1BWNz84zEb2oCMM6w2mzsSLDtTwP4I',
        'HGb4ml29bjBzn66SrTkksn1bF1434UStOpSHW0b2EpA3m1DIk5Mk24j',
        'HDKoM6RuiSg3kjHZA3IjmLyYMz4N1naWfkaKOTPnf1g8TooAEj142of',
        'H8HCCL6d9TG9hWod3l0B3atAWZSmbZF04cGbfhtZPKbtVrFcRrbEtuO',
        'H8XswwIdC4WWxi6bfwmHipVIRhOIr0Pn1xS2fvcyE1BtvbxGRzCImNx',
        'HB5XPk3LnGadskERVZ1ixVNmyvYi9bIab2UI4zsWDbMjxPgwtNCCh0f',
        'H2YpSP0b2HonTcV00ZTl9zuFJkdXHp5sNUnMzxozqyoqCqS4PAxpjfK',
        'HDhY6kItygBfriAnTjWphEfi4nEfWOLK27JMRnVLfHNgwu7TasZEdGf',
        'H2TDWssiRwuH2xZTd6T1wCELogXzkAzqLthD4KeMOy2cwAQZO54A1NV',
        'HI4geEVx5N5N3dqMTrE3eRNQZHgzZ0iUmj3DJF154R9vjm7HcNJrhFM',
        'HJnamauF8wXsezQNq3w5ieQ7Rx37FwOBdTW1eEOeWioD1L7xyNrGawu',
        'HHsrcMt70vMacAV4BV1qHVu9hx9EICXuFAPnWHYJsiGSS7FBYIwlPf6',
        'HFtfBHqkRiFBvLT8JfiGQuA9R5hwKq5GSK9aMRt4fdnJnaugx9lsB20',
        'H79GX1HJN8Plu0gPCYCyaiSyj0FMInN8pdKGayfrVMMW0gHzxBB6YMY',
        'H9PnsUrNsoU11B3dRhqhCc9kc8aSJ1jc013i2SIbkmS7YmSMAb0DFGw',
        'H1EYVjI8KjXb5Bm5lChhoqXyKIQYQ3XUDMxZUrbld8vZtIBbbgbs64Q',
        'H32BsdH4eaqch5CdrjEbkm6jPLLovFOCMWrOmOGa9B5xwC9s1xSGdmR',
        '29Ul6TVHNztIOxjap92qx3OpPPT9s77OPRtd60B0juWziVdebY2pnKfJRRvTHa8kMDJqxtoua60qN',
        '29T5X6wyPC8OluMoLda9h99asVHRVsTdmWdEVB7jsxGowqa2fQyUslHyxrrFfojmF5RfF3pYGGSKM',
        '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',
    ];

    for (const i in encStrings) {
        const s = encStrings[i];
        // repeat 'a' i times
        const eta = 'a'.repeat(+i);
        expect(decryptMetadata(s, key1)).toEqual(eta);
    }
});

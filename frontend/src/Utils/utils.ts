export function pluralize(count: number, words: string[]) {
    const cases = [2, 0, 1, 1, 1, 2];
    count = Math.abs(count);
    return count + ' ' + words[ (count % 100 > 4 && count % 100 < 20) ? 2 : cases[ Math.min(count % 10, 5)] ];
}

function isElementInView(el: HTMLElement, toBottom = false): boolean {
    const rect = el.getBoundingClientRect();
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;
    console.log('isElementInView', rect, windowHeight, toBottom);
    if (toBottom) {
        // Check if the bottom of the element is visible
        return rect.bottom <= windowHeight && rect.bottom >= 0;
    } else {
        // Check if the top of the element is visible
        return rect.top <= windowHeight && rect.top >= 0;
    }
}

export function scrollUnderTopbar(el: HTMLElement | (() => HTMLElement | null), toBottom?: boolean) {
    console.log('scrollUnderTopbar', el, toBottom);

    const scroll = (el: HTMLElement) => {
        el.scrollIntoView({ behavior: 'auto', block: toBottom ? 'end' : 'start' });
        const topbarHeight = document.getElementById('topbar')?.clientHeight;

        if (topbarHeight) {
            window.scrollBy({ top: -topbarHeight - 10 });
        }
    };

    let attempts = 5;
    const tryScroll = (check: boolean) => {
        const el0 = typeof el === 'function' ? el() : el;
        if (!el0) {
            console.log('no element');
            return;
        }
        console.log('tryScroll', check, attempts, 'containsEl:', document.body.contains(el0),
            'in view:', isElementInView(el0, toBottom));
        if (!check || document.body.contains(el0) && !isElementInView(el0, toBottom)) {
            console.log('scrolling');
            scroll(el0);
        }
        attempts--;
        if (attempts > 0) {
            setTimeout(() => tryScroll(true), 200);
        }
    };

    tryScroll(false);
}

// see https://stackoverflow.com/a/30106551/1349366
export function b64DecodeUnicode(str: string) {
    // Going backwards: from bytestream, to percent-encoding, to original string.
    return decodeURIComponent(atob(str).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
}

export function b64EncodeUnicode(str: string) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function(match, p1) {
        return String.fromCharCode(parseInt(p1, 16));
    }));
}
export function pluralize(count: number, words: string[]) {
    const cases = [2, 0, 1, 1, 1, 2];
    count = Math.abs(count);
    return count + ' ' + words[ (count % 100 > 4 && count % 100 < 20) ? 2 : cases[ Math.min(count % 10, 5)] ];
}

export function scrollUnderTopbar(el: HTMLElement, toBottom?: boolean) {
    if(!el) {
        return;
    }

    // do not use `smooth` here - it is too slow and element won't focus into view correctly
    el.scrollIntoView({behavior: 'auto', block: toBottom ? 'end' : 'start' });
    // compensate for topbar height - otherwise element will be partially covered
    const topbarHeight = document.getElementById('topbar')?.clientHeight;

    if (topbarHeight) {
        window.scrollBy({top: -topbarHeight - 10});
    }

}

// see https://stackoverflow.com/a/30106551/1349366
export function b64DecodeUnicode(str: string) {
    // Going backwards: from bytestream, to percent-encoding, to original string.
    return decodeURIComponent(atob(str).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
}
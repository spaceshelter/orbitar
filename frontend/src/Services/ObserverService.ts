type IntersectionCallback = (entry: IntersectionObserverEntry) => void;
type ElementCallbacks = WeakMap<Element, Set<IntersectionCallback>>;

const INTERSECTION_RATIO = .5;
const intersectionObserver: IntersectionObserver = new IntersectionObserver(
    handleIntersections,
    {
        rootMargin: '0px',
        threshold: 0.5,
    },
);
const onShown: ElementCallbacks = new WeakMap();
const onHidden: ElementCallbacks = new WeakMap();

function handleIntersections(entries: IntersectionObserverEntry[]) {
    entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio > INTERSECTION_RATIO) {
            fireEvent(onShown, entry);
        } else {
            fireEvent(onHidden, entry);
        }
    });
}

function fireEvent(callbacks: ElementCallbacks, entry: IntersectionObserverEntry) {
    const cbs = callbacks.get(entry.target);
    cbs && Array.from(cbs, (cb)=> cb(entry));
}

function addEventListener(callbacks: ElementCallbacks, el: Element, cb: IntersectionCallback) {
    const cbs = callbacks.get(el);
    (cbs && cbs.add(cb)) || callbacks.set(el, new Set([cb]));
}

function removeEventListener(callbacks: ElementCallbacks, el: Element, cb: IntersectionCallback) {
    const cbs = callbacks.get(el);
    cbs && cbs.delete(cb);
}

export function observeOnShown(el: Element, callback: IntersectionCallback) {
    addEventListener(onShown, el, callback);
    intersectionObserver.observe(el);
}

export function observeOnHidden(el: Element, callback: IntersectionCallback) {
    addEventListener(onHidden, el, callback);
    intersectionObserver.observe(el);
}

export function unobserveOnShown(el: Element, callback: IntersectionCallback) {
    removeEventListener(onShown, el, callback);
    intersectionObserver.unobserve(el);
}

export function unobserveOnHidden(el: Element, callback: IntersectionCallback) {
    removeEventListener(onHidden, el, callback);
    intersectionObserver.unobserve(el);
}

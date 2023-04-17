
type CacheRecord = {
    deps: unknown[];
    value: unknown;
};
const localCache: Record<string, CacheRecord> = {};

function getCachedValue<T>(name: string, deps: unknown[]): T | undefined {
    let cached: CacheRecord | undefined = localCache[name];
    if (!cached) {
        // try to load from localStorage
        const value = localStorage.getItem('cache:'+name);
        if (value) {
            try {
                const jsonValue = JSON.parse(value) as CacheRecord;
                if (jsonValue.deps && jsonValue.value) {
                    cached = jsonValue;
                    localCache[name] = cached;
                }
            }
            catch {
                // do nothing
            }
        }
    }

    if (cached) {
        if (cached.deps.length !== deps.length) {
            cached = undefined;
        }
        else {
            for (let i = 0; i < deps.length; i++) {
                if (cached.deps[i] !== deps[i]) {
                    cached = undefined;
                    break;
                }
            }
        }
    }

    if (cached) {
        return cached.value as T;
    }
}
function setCachedValue<T>(name: string, deps: unknown[], value: T) {
    const cached: CacheRecord = { deps: [...deps], value };
    localCache[name] = cached;

    // check if only simple objects in deps
    for (const dep of deps) {
        const typeDep = typeof dep;
        if (typeDep !== 'boolean' && typeDep !== 'number' && typeDep !== 'string') {
            return;
        }
    }

    try {
        localStorage.setItem('cache:' + name, JSON.stringify(cached));
    } catch (e) {
        console.error('Error while saving cache', e);
    }
}

export function useCache<T>(name: string, deps: unknown[]): [T | undefined, ((value: T) => void)] {
    const cached: T | undefined = getCachedValue(name, deps);

    const setCached = (value: T) => {
        setCachedValue(name, deps, value);
    };

    return [
        cached,
        setCached
    ];
}


type CacheRecord = {
    deps: any[];
    value: any;
}
const localCache: Record<string, CacheRecord> = {};

function getCachedValue<T>(name: string, deps: any[]): T | undefined {
    let cached: CacheRecord | undefined = localCache[name];
    if (!cached) {
        // try to load from localStorage
        let value = localStorage.getItem('cache:'+name);
        if (value) {
            try {
                let jsonValue = JSON.parse(value) as CacheRecord;
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
        return cached.value;
    }
}
function setCachedValue<T>(name: string, deps: any[], value: T) {
    const cached: CacheRecord = { deps: [...deps], value };
    localCache[name] = cached;

    // check if only simple objects in deps
    for (let dep of deps) {
        let typeDep = typeof dep;
        if (typeDep !== 'boolean' && typeDep !== 'number' && typeDep !== 'string') {
            return;
        }
    }

    localStorage.setItem('cache:'+name, JSON.stringify(cached));
}

export function useCache<T>(name: string, deps: any[]): [T | undefined, ((value: T) => void)] {
    let cached: T | undefined = getCachedValue(name, deps);

    const setCached = (value: T) => {
        setCachedValue(name, deps, value);
    }

    return [
        cached,
        setCached
    ]
}

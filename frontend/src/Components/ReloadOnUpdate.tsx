import {observer} from 'mobx-react-lite';
import {useEffect, useState} from 'react';
import {useLocation} from 'react-router-dom';
import {useAppState} from '../AppState/AppState';

/**
 * Extracts the post id from the path:
 * /p1234 -> 1234
 * /s/abc/p1234 -> 1234
 * if no post id is found, returns null
 * @param path
 */
function extractPost(path: string) {
    const postMatch = path.match(/\/p(\d+)/);
    if (postMatch) {
        return parseInt(postMatch[1]);
    }
    return null;
}

/**
 * Reloads the page when update is available and location changes
 * (except when the url changes within the same post)
 */
export const ReloadOnUpdate = observer((
    props: {
        children: React.ReactNode;
    },
) => {
    const location = useLocation();
    const [prevLocation, setPrevLocation] = useState(location);
    const {isUpdateAvailable} = useAppState();

    const needsReload =
        isUpdateAvailable &&
        prevLocation.key !== location.key &&
        (!extractPost(location.pathname) || extractPost(location.pathname) !== extractPost(prevLocation.pathname));

    useEffect(() => {
        if (needsReload) {
            window.location.reload();
        }
    }, [needsReload]);

    useEffect(() => {
        if (prevLocation !== location) {
            setPrevLocation(location);
        }
    }, [location]);

    return (needsReload ? <></> : <>{props.children}</>);
});
import {Link, LinkProps} from 'react-router-dom';
import React from 'react';
import {useAppState} from '../AppState/AppState';

/**
 * Behaves like a regular Link, except:
 *  triggers reload when clicked, if the current location matches the `to` prop.
 * @param props
 * @constructor
 */
export const ReloadingLink = (props: LinkProps & React.RefAttributes<HTMLAnchorElement>) => {
    const appState = useAppState();
    const onClick = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
        if (props.onClick) {
            props.onClick(e);
        }
        // if default prevented
        if (e.isDefaultPrevented()) {
            return;
        }

        let to;

        if (typeof props.to === 'string') {
            to = new URL(props.to, window.location.href);
        } else if (typeof props.to === 'object') {
            to = props.to;
        } else {
            return;
        }

        if (to.pathname === window.location.pathname
            && to.search === window.location.search
            && to.hash === window.location.hash
        ) {
            appState.forceReload();
        }
    };

    return (
        <Link {...props} onClick={onClick}>{props.children}</Link>
    );
};
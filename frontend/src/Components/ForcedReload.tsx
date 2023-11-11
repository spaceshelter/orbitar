import {observer} from 'mobx-react-lite';
import {useAppState} from '../AppState/AppState';

/**
 * Remounts the child component (effectively reloading it) when
 * AppState.reloadCounter is changed.
 */
export const ForcedReload = observer((
    props: {
        children: React.ReactNode;
    },
) => {
    const {reloadCounter} = useAppState();
    return (
        <DummyChild key={reloadCounter}>
            {props.children}
        </DummyChild>);
});

const DummyChild = (props: {
    children: React.ReactNode;
}) => <>{props.children}</>;
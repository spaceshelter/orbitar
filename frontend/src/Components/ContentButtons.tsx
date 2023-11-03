import React from 'react';
import styles from './ContentButtons.module.scss';

interface BaseButtonProps {
    inProgress?: boolean
    onClick: () => void
    className?: string
    icon?: string
    label?: string
    isActive?: boolean
}

function BaseButton ({className: classN='', inProgress = false, isActive=false, icon, onClick, label}: BaseButtonProps) {
    const className = `${classN} 
    i i-${icon} ${styles.icon} 
    ${inProgress ? styles.inProgress : ''} 
    ${isActive ? styles.active : ''}`;

    return (
    <button
        className={className}
        onClick={onClick}
    >
        {label && <div className={styles.label}>{label}</div>}
    </button>);
}

interface ExtendedButtonProps extends BaseButtonProps {
    iconOnly?: boolean
}

export function TranslateButton ({iconOnly = false, ...props}: ExtendedButtonProps) {
    return <BaseButton {...props} icon='translate' label={iconOnly ? '' : 'Перевести'} />;
}
export function AltTranslateButton ({iconOnly = false, ...props}: ExtendedButtonProps) {
    return <BaseButton {...props} icon='alttranslate' label={iconOnly ? '' : 'ЪУЪ'} />;
}
export function AnnotateButton ({iconOnly = false, ...props}: ExtendedButtonProps) {
    return <BaseButton {...props} icon='annotate' label={iconOnly ? '' : 'Скукожить'} />;
}

export function WatchButton (props: ExtendedButtonProps) {
    return <BaseButton {...props} icon='watch' label='Отслеживать' />;
}

export function UnwatchButton (props: ExtendedButtonProps) {
    return <BaseButton {...props} icon='unwatch' label='Не отслеживать' />;
}

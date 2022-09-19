import React, { useEffect, useState } from 'react';
import styles from './Hamburger.module.scss';
import classNames from 'classnames';

type HamburgerProps = {
    open: boolean;
};

export const Hamburger = (props: HamburgerProps) => {
    const [transformUpperRect, setTransformUpperRect] = useState('');
    const [transformLowerRect, setTransformLowerRect] = useState('');
    const dropRotate = () => {
        setTransformUpperRect('');
        setTransformLowerRect('');
    };

    useEffect(() => {
        if (props.open) {
          dropRotate();
        } else {
          setTransformUpperRect('rotate(45) translate(-4 -20)');
          setTransformLowerRect('rotate(-45) translate(2 2)');
        }  
    }, [props.open]);

    return (
        <div className={classNames(styles.hamburger, {
              [styles.open]: props.open,
        })}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 34 13"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className={styles.icon}
            >
                <rect
                  width="34"
                  height="3"
                  fill="#2A2B40"
                  transform={transformUpperRect}
                />
                <rect
                  y="10"
                  width="34"
                  height="3"
                  fill="#2A2B40"
                  transform={transformLowerRect}
                />
            </svg>
        </div>
    );
};

import React from 'react';
import styles from './Hamburger.module.scss';
import classNames from 'classnames';

type HamburgerProps = {
    open: boolean;
};

export const Hamburger = (props: HamburgerProps) => {
    return (
      <svg
          className={classNames(styles.hamburger, {
              [styles.open]: props.open,
          })}
          width="24"
          height="24"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
      >
          <rect x="3" y="5.99998" width="18" height="1"/>
          <rect x="3" y="10.99998" width="18" height="1"/>
          <rect x="3" y="15.99998" width="18" height="1"/>
      </svg>
    );
};

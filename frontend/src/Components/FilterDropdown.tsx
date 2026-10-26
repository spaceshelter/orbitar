import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'

import Button from '@ui/Button'
import classNames from 'classnames'

import useDocumentEvent from '../API/use/useDocumentEvent'

import styles from './FilterDropdown.module.scss'

// React 18's useId is not in the @types/react this project pins.
let dropdownCount = 0

const menuItems = (menu: HTMLElement | null) =>
  Array.from(menu?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') || [])

const focusChecked = (menu: HTMLElement | null) => {
  const list = menuItems(menu)
  const checked = list.findIndex((item) => item.getAttribute('aria-checked') === 'true')
  list[Math.max(checked, 0)]?.focus()
}

export type FilterMenuItem = { key: string; label: string; checked: boolean; onSelect: () => void }
export type FilterMenuGroup = { key: string; heading?: string; items: FilterMenuItem[] }

type FilterDropdownProps = {
  label: string
  menuLabel: string
  groups: FilterMenuGroup[]
  note?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

// A menu button with radio items, following the WAI-ARIA menu button pattern:
// opening moves focus to the checked item, arrows, Home and End move between
// items, Escape and a choice return focus to the button, Tab and a click
// elsewhere close the menu.
export default function FilterDropdown({ label, menuLabel, groups, note, open, onOpenChange }: FilterDropdownProps) {
  const [id] = useState(() => `filter-dropdown-${++dropdownCount}`)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [alignEnd, setAlignEnd] = useState(false)

  const trigger = () => rootRef.current?.querySelector<HTMLElement>('[aria-haspopup="menu"]')
  const close = (returnFocus: boolean) => {
    onOpenChange(false)
    if (returnFocus) {
      trigger()?.focus()
    }
  }

  // A menu that would run past the right edge of the screen opens leftwards
  // from its button instead.
  useLayoutEffect(() => {
    const menu = menuRef.current?.getBoundingClientRect()
    const root = rootRef.current?.getBoundingClientRect()
    const viewport = document.documentElement.clientWidth
    setAlignEnd(!!menu && !!root && root.left + menu.width > viewport - 8 && root.right - menu.width >= 8)
  }, [open])

  useEffect(() => {
    if (open) {
      focusChecked(menuRef.current)
    }
  }, [open])

  useDocumentEvent(
    'keydown',
    (event) => {
      if (event.key === 'Escape') {
        close(!!rootRef.current?.contains(document.activeElement))
      }
    },
    open,
  )
  useDocumentEvent(
    'mousedown',
    (event) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        close(false)
      }
    },
    open,
  )

  const handleTriggerKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (open) {
        focusChecked(menuRef.current)
      } else {
        onOpenChange(true)
      }
    }
  }

  const handleMenuKeyDown = (event: React.KeyboardEvent) => {
    const list = menuItems(menuRef.current)
    const current = list.indexOf(document.activeElement as HTMLElement)
    const move = (index: number) => {
      event.preventDefault()
      list[(index + list.length) % list.length]?.focus()
    }
    switch (event.key) {
      case 'ArrowDown':
        move(current + 1)
        break
      case 'ArrowUp':
        move(current < 0 ? list.length - 1 : current - 1)
        break
      case 'Home':
        move(0)
        break
      case 'End':
        move(list.length - 1)
        break
      case 'Tab':
        onOpenChange(false)
        break
    }
  }

  const renderItem = (item: FilterMenuItem) => (
    <Button
      key={item.key}
      variant='minimal'
      role='menuitemradio'
      aria-checked={item.checked}
      tabIndex={-1}
      className={classNames(styles.menuItem, item.checked && styles.menuItemActive)}
      onClick={() => {
        item.onSelect()
        close(true)
      }}
    >
      {item.label}
    </Button>
  )

  return (
    <div className={styles.dropdown} ref={rootRef}>
      <Button
        variant='ghost'
        className={styles.dropdownButton}
        aria-haspopup='menu'
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        onClick={() => onOpenChange(!open)}
        onKeyDown={handleTriggerKeyDown}
      >
        {label}
        <span className={styles.caret} aria-hidden='true'>
          ▾
        </span>
      </Button>
      {open && (
        <div
          className={classNames(styles.menu, alignEnd && styles.menuAlignEnd)}
          id={`${id}-menu`}
          ref={menuRef}
          role='menu'
          aria-label={menuLabel}
          aria-describedby={note ? `${id}-note` : undefined}
          onKeyDown={handleMenuKeyDown}
        >
          {groups.map((group, index) => (
            <React.Fragment key={group.key}>
              {index > 0 && <div className={styles.menuSeparator} role='separator' />}
              {group.heading ? (
                <div role='group' aria-labelledby={`${id}-${group.key}`}>
                  <div className={styles.menuHeading} id={`${id}-${group.key}`} role='presentation'>
                    {group.heading}
                  </div>
                  {group.items.map(renderItem)}
                </div>
              ) : (
                group.items.map(renderItem)
              )}
            </React.Fragment>
          ))}
          {note && (
            <div className={styles.menuNote} id={`${id}-note`} role='presentation'>
              {note}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

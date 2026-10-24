import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'

import Button from '@ui/Button'
import classNames from 'classnames'

import styles from './FilterDropdown.module.scss'

// React 18's useId is not in the @types/react this project pins.
let dropdownCount = 0

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
  const onOpenChangeRef = useRef(onOpenChange)
  onOpenChangeRef.current = onOpenChange
  const [alignEnd, setAlignEnd] = useState(false)

  const trigger = () => rootRef.current?.querySelector<HTMLElement>('[aria-haspopup="menu"]')
  const items = () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') || [])
  const focusChecked = () => {
    const list = items()
    const checked = list.findIndex((item) => item.getAttribute('aria-checked') === 'true')
    list[Math.max(checked, 0)]?.focus()
  }
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
    if (!open) {
      return
    }
    const list = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') || [])
    const checked = list.findIndex((item) => item.getAttribute('aria-checked') === 'true')
    list[Math.max(checked, 0)]?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        const hadFocus = !!rootRef.current?.contains(document.activeElement)
        onOpenChangeRef.current(false)
        if (hadFocus) {
          rootRef.current?.querySelector<HTMLElement>('[aria-haspopup="menu"]')?.focus()
        }
      }
    }
    const handleMouseDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        onOpenChangeRef.current(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleMouseDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleMouseDown)
    }
  }, [open])

  const handleTriggerKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (open) {
        focusChecked()
      } else {
        onOpenChange(true)
      }
    }
  }

  const handleMenuKeyDown = (event: React.KeyboardEvent) => {
    const list = items()
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

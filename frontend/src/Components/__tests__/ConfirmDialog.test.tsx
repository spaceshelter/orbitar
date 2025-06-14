import React from 'react'

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import ConfirmDialog from '../ConfirmDialog'

describe('ConfirmDialog', () => {
  test('calls onConfirm and onCancel', async () => {
    const onConfirm = jest.fn()
    const onCancel = jest.fn()
    render(<ConfirmDialog message='Test message' onConfirm={onConfirm} onCancel={onCancel} />)

    expect(screen.getByText('Test message')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Да!' }))
    expect(onConfirm).toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Отмена' }))
    expect(onCancel).toHaveBeenCalled()
  })
})

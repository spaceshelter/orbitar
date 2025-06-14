import React from 'react'

import { render, screen } from '@testing-library/react'

import { Button } from '../UI/Button'

describe('Button', () => {
  test('renders children', () => {
    render(<Button>Click</Button>)
    expect(screen.getByRole('button')).toHaveTextContent('Click')
  })

  test('shows loader when loading', () => {
    render(<Button loading>Load</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
    expect(screen.queryByText('Load')).not.toBeInTheDocument()
  })
})

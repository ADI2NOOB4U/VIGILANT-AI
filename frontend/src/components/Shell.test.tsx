import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Shell } from './Shell'

describe('Shell mobile navigation', () => {
  afterEach(cleanup)

  it('opens accessibly, closes with Escape, and returns focus to the menu button', async () => {
    render(
      <Shell page="scan" onNavigate={vi.fn()} health={null}>
        <div>Current page</div>
      </Shell>
    )

    const openButton = screen.getByRole('button', { name: 'Open navigation menu' })
    fireEvent.click(openButton)

    const navigation = screen.getByRole('navigation', { name: 'Mobile navigation' })
    expect(openButton.getAttribute('aria-expanded')).toBe('true')
    expect(openButton.getAttribute('aria-controls')).toBe('mobile-navigation')
    expect(screen.getByRole('button', { name: 'Scan', current: 'page' })).toBeDefined()
    expect(document.activeElement).toBe(navigation.querySelector('button'))

    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(openButton))
  })

  it('navigates to a selected section and closes the menu', async () => {
    const onNavigate = vi.fn()
    render(
      <Shell page="scan" onNavigate={onNavigate} health={true}>
        <div>Current page</div>
      </Shell>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }))
    const navigation = screen.getByRole('navigation', { name: 'Mobile navigation' })
    fireEvent.click(within(navigation).getByRole('button', { name: 'India Cyber Law' }))

    expect(onNavigate).toHaveBeenCalledWith('laws')
    await waitFor(() => expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).toBeNull())
    expect(screen.getByLabelText('Backend online')).toBeDefined()
  })
})

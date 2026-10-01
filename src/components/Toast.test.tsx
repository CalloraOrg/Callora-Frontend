import { render, screen, act, fireEvent } from '@testing-library/react';
import { ToastProvider, useToast } from './Toast';
import { useEffect } from 'react';

const TestComponent = ({ testCase }: { testCase: number }) => {
  const { showToast } = useToast();

  useEffect(() => {
    if (testCase === 1) {
      showToast({ message: 'Persistent Toast', persistent: true });
    } else if (testCase === 2) {
      showToast({ message: 'Custom Duration', duration: 1000 });
    } else if (testCase === 3) {
      showToast('Error Toast', 'error');
    } else if (testCase === 4) {
      showToast({ message: '1', persistent: true });
      showToast({ message: '2', persistent: false });
      showToast({ message: '3', persistent: true });
      showToast({ message: '4', persistent: false });
      showToast({ message: '5', persistent: true });
    }
  }, [testCase, showToast]);

  return null;
};

describe('Toast Component', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('keeps persistent toast until dismissed', () => {
    render(
      <ToastProvider>
        <TestComponent testCase={1} />
      </ToastProvider>
    );
    expect(screen.getByText('Persistent Toast')).toBeInTheDocument();
    
    act(() => {
      jest.advanceTimersByTime(10000);
    });
    
    expect(screen.getByText('Persistent Toast')).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /Dismiss notification/i });
    fireEvent.click(closeBtn);
    
    act(() => {
      jest.advanceTimersByTime(500);
    });
    
    expect(screen.queryByText('Persistent Toast')).not.toBeInTheDocument();
  });

  it('custom duration dismisses the toast after that many milliseconds', () => {
    render(
      <ToastProvider>
        <TestComponent testCase={2} />
      </ToastProvider>
    );
    expect(screen.getByText('Custom Duration')).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(900);
    });
    expect(screen.getByText('Custom Duration')).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(300); // 900 + 300 = 1200 > 1000 + 200 (animation)
    });
    expect(screen.queryByText('Custom Duration')).not.toBeInTheDocument();
  });

  it('existing showToast(message, "error") calls continue to compile and work, defaulting to 10s', () => {
    render(
      <ToastProvider>
        <TestComponent testCase={3} />
      </ToastProvider>
    );
    expect(screen.getByText('Error Toast')).toBeInTheDocument();
    
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    // Should still be there because error default is 10s
    expect(screen.getByText('Error Toast')).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(5500); // 10500 total
    });
    expect(screen.queryByText('Error Toast')).not.toBeInTheDocument();
  });

  it('when the queue exceeds four, a non-persistent toast is evicted before a persistent one', () => {
    render(
      <ToastProvider>
        <TestComponent testCase={4} />
      </ToastProvider>
    );
    // added: 1(P), 2(NP), 3(P), 4(NP), 5(P)
    // max toasts = 4
    // when 5(P) is added, we have 4 items: 1(P), 2(NP), 3(P), 4(NP)
    // 2(NP) should be evicted because it's the first non-persistent
    // remaining: 1(P), 3(P), 4(NP), 5(P)
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.queryByText('2')).not.toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });
});

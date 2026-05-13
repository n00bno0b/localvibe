import * as React from 'react';

export interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger';
}

export function PrimaryActionButton({ variant = 'primary', style, ...props }: ActionButtonProps) {
    let bg = '#007acc';
    let color = 'white';

    if (variant === 'secondary') {
        bg = '#555';
    } else if (variant === 'danger') {
        bg = '#ff5555';
    }

    return (
        <button
            {...props}
            style={{
                padding: '6px 15px',
                background: props.disabled ? '#333' : bg,
                color: props.disabled ? '#888' : color,
                border: 'none',
                borderRadius: '4px',
                cursor: props.disabled ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
                ...style
            }}
        />
    );
}

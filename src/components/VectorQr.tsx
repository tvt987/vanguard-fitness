import React, { useMemo } from 'react';
import { generateQrMatrix } from '../engines/membership';

interface VectorQrProps {
  payload: string;
  sizePx?: number;
  fgColor?: string;
  bgColor?: string;
  className?: string;
  label?: string;
}

export const VectorQr: React.FC<VectorQrProps> = ({
  payload,
  sizePx = 128,
  fgColor = '#08090c',
  bgColor = '#ffffff',
  className = '',
  label = 'Vanguard Digital QR Code',
}) => {
  const matrix = useMemo(() => generateQrMatrix(payload, 21), [payload]);
  const quiet = 2;
  const viewSize = matrix.length + quiet * 2;

  return (
    <svg
      width={sizePx}
      height={sizePx}
      viewBox={`0 0 ${viewSize} ${viewSize}`}
      role="img"
      aria-label={label}
      className={className}
      shapeRendering="crispEdges"
    >
      <rect width={viewSize} height={viewSize} fill={bgColor} rx="1" />
      {matrix.map((row, rIdx) =>
        row.map((on, cIdx) =>
          on ? (
            <rect
              key={`${rIdx}-${cIdx}`}
              x={cIdx + quiet}
              y={rIdx + quiet}
              width={1}
              height={1}
              fill={fgColor}
            />
          ) : null
        )
      )}
    </svg>
  );
};

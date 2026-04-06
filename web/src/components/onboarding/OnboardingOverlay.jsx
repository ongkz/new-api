/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button, Space, Typography } from '@douyinfe/semi-ui';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import './onboarding.css';

const { Text, Title } = Typography;

const VIEWPORT_MARGIN = 12;
const MIN_CARD_SPOTLIGHT_GAP = 28;
const MIN_SAFE_CARD_SPOTLIGHT_GAP = 12;
const MIN_CARD_EDGE_CLEARANCE = 4;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function isElementTarget(target) {
  return typeof Element !== 'undefined' && target instanceof Element;
}

function getSpotlightRect(rect, padding) {
  const viewportWidth =
    typeof window === 'undefined' ? rect.right + padding : window.innerWidth;
  const viewportHeight =
    typeof window === 'undefined' ? rect.bottom + padding : window.innerHeight;
  const rawTop = rect.top - padding;
  const rawLeft = rect.left - padding;
  const rawRight = rect.right + padding;
  const rawBottom = rect.bottom + padding;
  const top = Math.max(rawTop, 0);
  const left = Math.max(rawLeft, 0);
  const right = Math.min(rawRight, viewportWidth);
  const bottom = Math.min(rawBottom, viewportHeight);

  return {
    top,
    left,
    width: Math.max(right - left, 0),
    height: Math.max(bottom - top, 0),
    right,
    bottom,
    rawTop,
    rawLeft,
    rawRight,
    rawBottom,
    rawWidth: Math.max(rawRight - rawLeft, 0),
    rawHeight: Math.max(rawBottom - rawTop, 0),
    isClippedVertically: rawTop < 0 || rawBottom > viewportHeight,
  };
}

function getCandidatePosition(placement, spotlightRect, cardSize, gap) {
  const centerX = spotlightRect.left + spotlightRect.width / 2;
  const centerY = spotlightRect.top + spotlightRect.height / 2;

  switch (placement) {
    case 'top':
      return {
        top: spotlightRect.top - cardSize.height - gap,
        left: centerX - cardSize.width / 2,
      };
    case 'left':
      return {
        top: centerY - cardSize.height / 2,
        left: spotlightRect.left - cardSize.width - gap,
      };
    case 'right':
      return {
        top: centerY - cardSize.height / 2,
        left: spotlightRect.right + gap,
      };
    case 'bottom':
    default:
      return {
        top: spotlightRect.bottom + gap,
        left: centerX - cardSize.width / 2,
      };
  }
}

function getOrderedPlacements(preferredPlacement) {
  const fallbackPlacements = ['bottom', 'top', 'right', 'left'];
  if (!preferredPlacement || preferredPlacement === 'auto') {
    return fallbackPlacements;
  }
  return [
    preferredPlacement,
    ...fallbackPlacements.filter((item) => item !== preferredPlacement),
  ];
}

function clampCardToViewport(candidate, cardSize, viewportWidth, viewportHeight) {
  return {
    top: clamp(
      candidate.top,
      VIEWPORT_MARGIN,
      Math.max(
        viewportHeight - cardSize.height - VIEWPORT_MARGIN,
        VIEWPORT_MARGIN,
      ),
    ),
    left: clamp(
      candidate.left,
      VIEWPORT_MARGIN,
      Math.max(viewportWidth - cardSize.width - VIEWPORT_MARGIN, VIEWPORT_MARGIN),
    ),
  };
}

function getOverlapArea(rectA, rectB) {
  const overlapWidth =
    Math.min(rectA.left + rectA.width, rectB.left + rectB.width) -
    Math.max(rectA.left, rectB.left);
  const overlapHeight =
    Math.min(rectA.top + rectA.height, rectB.top + rectB.height) -
    Math.max(rectA.top, rectB.top);

  if (overlapWidth <= 0 || overlapHeight <= 0) {
    return 0;
  }

  return overlapWidth * overlapHeight;
}

function getExactCardPosition(
  candidatePlacement,
  spotlightRect,
  cardSize,
  viewportWidth,
  viewportHeight,
  gap,
) {
  const centerX = (spotlightRect.rawLeft + spotlightRect.rawRight) / 2;
  const centerY = (spotlightRect.rawTop + spotlightRect.rawBottom) / 2;
  const safeLeft = VIEWPORT_MARGIN;
  const safeTop = VIEWPORT_MARGIN;
  const safeRight = Math.max(
    viewportWidth - cardSize.width - VIEWPORT_MARGIN,
    VIEWPORT_MARGIN,
  );
  const safeBottom = Math.max(
    viewportHeight - cardSize.height - VIEWPORT_MARGIN,
    VIEWPORT_MARGIN,
  );
  const isLargeTarget =
    spotlightRect.rawHeight > viewportHeight * 0.6 ||
    spotlightRect.rawWidth > viewportWidth * 0.6;

  switch (candidatePlacement) {
    case 'top': {
      const availableGap =
        spotlightRect.rawTop - VIEWPORT_MARGIN - cardSize.height;
      if (availableGap < MIN_SAFE_CARD_SPOTLIGHT_GAP) return null;
      const resolvedGap = Math.min(gap, availableGap);
      const edgeClearance = availableGap - resolvedGap;
      if (edgeClearance < MIN_CARD_EDGE_CLEARANCE) return null;
      const bottom = viewportHeight - spotlightRect.rawTop + resolvedGap;
      const top = viewportHeight - bottom - cardSize.height;
      const idealLeft = centerX - cardSize.width / 2;
      const left = clamp(idealLeft, safeLeft, safeRight);
      return {
        top,
        bottom,
        left,
        alignmentOffset: Math.abs(left - idealLeft),
        gapLoss: gap - resolvedGap,
        placement: candidatePlacement,
      };
    }
    case 'bottom': {
      const availableGap =
        viewportHeight -
        VIEWPORT_MARGIN -
        spotlightRect.rawBottom -
        cardSize.height;
      if (availableGap < MIN_SAFE_CARD_SPOTLIGHT_GAP) return null;
      const resolvedGap = Math.min(gap, availableGap);
      const edgeClearance = availableGap - resolvedGap;
      if (edgeClearance < MIN_CARD_EDGE_CLEARANCE) return null;
      const top = spotlightRect.rawBottom + resolvedGap;
      const idealLeft = centerX - cardSize.width / 2;
      const left = clamp(idealLeft, safeLeft, safeRight);
      return {
        top,
        left,
        alignmentOffset: Math.abs(left - idealLeft),
        gapLoss: gap - resolvedGap,
        placement: candidatePlacement,
      };
    }
    case 'left': {
      if (spotlightRect.isClippedVertically && !isLargeTarget) return null;
      const availableGap =
        spotlightRect.rawLeft - VIEWPORT_MARGIN - cardSize.width;
      if (availableGap < MIN_SAFE_CARD_SPOTLIGHT_GAP) return null;
      const resolvedGap = Math.min(gap, availableGap);
      const edgeClearance = availableGap - resolvedGap;
      if (edgeClearance < MIN_CARD_EDGE_CLEARANCE) return null;
      const right = viewportWidth - spotlightRect.rawLeft + resolvedGap;
      const left = viewportWidth - right - cardSize.width;
      const idealTop = centerY - cardSize.height / 2;
      const top = clamp(idealTop, safeTop, safeBottom);
      return {
        top,
        left,
        right,
        alignmentOffset: Math.abs(top - idealTop),
        gapLoss: gap - resolvedGap,
        placement: candidatePlacement,
      };
    }
    case 'right': {
      if (spotlightRect.isClippedVertically && !isLargeTarget) return null;
      const availableGap =
        viewportWidth -
        VIEWPORT_MARGIN -
        spotlightRect.rawRight -
        cardSize.width;
      if (availableGap < MIN_SAFE_CARD_SPOTLIGHT_GAP) return null;
      const resolvedGap = Math.min(gap, availableGap);
      const edgeClearance = availableGap - resolvedGap;
      if (edgeClearance < MIN_CARD_EDGE_CLEARANCE) return null;
      const left = spotlightRect.rawRight + resolvedGap;
      const idealTop = centerY - cardSize.height / 2;
      const top = clamp(idealTop, safeTop, safeBottom);
      return {
        top,
        left,
        alignmentOffset: Math.abs(top - idealTop),
        gapLoss: gap - resolvedGap,
        placement: candidatePlacement,
      };
    }
    default:
      return null;
  }
}

function getCardPosition(spotlightRect, cardSize, placement) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const gap = Math.max(placement?.offset ?? 16, MIN_CARD_SPOTLIGHT_GAP);
  const orderedPlacements = getOrderedPlacements(placement?.name);
  let bestExactCandidate = null;

  for (const candidatePlacement of orderedPlacements) {
    const exactCandidate = getExactCardPosition(
      candidatePlacement,
      spotlightRect,
      cardSize,
      viewportWidth,
      viewportHeight,
      gap,
    );

    if (exactCandidate) {
      if (
        !bestExactCandidate ||
        exactCandidate.alignmentOffset < bestExactCandidate.alignmentOffset ||
        (exactCandidate.alignmentOffset ===
          bestExactCandidate.alignmentOffset &&
          exactCandidate.gapLoss < bestExactCandidate.gapLoss) ||
        (exactCandidate.alignmentOffset ===
          bestExactCandidate.alignmentOffset &&
          exactCandidate.gapLoss === bestExactCandidate.gapLoss &&
          orderedPlacements.indexOf(candidatePlacement) <
            orderedPlacements.indexOf(bestExactCandidate.placement))
      ) {
        bestExactCandidate = exactCandidate;
      }
    }
  }

  if (bestExactCandidate) {
    return bestExactCandidate;
  }

  let bestCandidate = null;

  for (const candidatePlacement of orderedPlacements) {
    const rawCandidate = getCandidatePosition(
      candidatePlacement,
      spotlightRect,
      cardSize,
      gap,
    );
    const candidate = clampCardToViewport(
      rawCandidate,
      cardSize,
      viewportWidth,
      viewportHeight,
    );
    const overlapArea = getOverlapArea(
      {
        top: candidate.top,
        left: candidate.left,
        width: cardSize.width,
        height: cardSize.height,
      },
      spotlightRect,
    );

    if (
      !bestCandidate ||
      overlapArea < bestCandidate.overlapArea ||
      (overlapArea === bestCandidate.overlapArea &&
        orderedPlacements.indexOf(candidatePlacement) <
          orderedPlacements.indexOf(bestCandidate.placement))
    ) {
      bestCandidate = {
        ...candidate,
        placement: candidatePlacement,
        overlapArea,
      };
    }
  }

  return bestCandidate
    ? {
        top: bestCandidate.top,
        left: bestCandidate.left,
        bottom: bestCandidate.bottom,
        right: bestCandidate.right,
        placement: bestCandidate.placement,
      }
    : null;
}

function getArrowPosition(placement, spotlightRect, cardPosition) {
  const centerX = spotlightRect.left + spotlightRect.width / 2;
  const centerY = spotlightRect.top + spotlightRect.height / 2;

  switch (placement) {
    case 'top':
      return {
        top: '100%',
        left: clamp(centerX - cardPosition.left, 28, cardPosition.width - 28),
      };
    case 'left':
      return {
        top: clamp(centerY - cardPosition.top, 28, cardPosition.height - 28),
        left: '100%',
      };
    case 'right':
      return {
        top: clamp(centerY - cardPosition.top, 28, cardPosition.height - 28),
        left: 0,
      };
    case 'bottom':
    default:
      return {
        top: 0,
        left: clamp(centerX - cardPosition.left, 28, cardPosition.width - 28),
      };
  }
}
const OnboardingOverlay = ({ guide, target, onConfirm, onDismissAll }) => {
  const { t } = useTranslation();
  const cardRef = useRef(null);
  const [targetRect, setTargetRect] = useState(null);
  const [cardSize, setCardSize] = useState({ width: 320, height: 180 });
  const [placementOverride, setPlacementOverride] = useState(null);
  const [viewportSize, setViewportSize] = useState(() => ({
    width: typeof window === 'undefined' ? 0 : window.innerWidth,
    height: typeof window === 'undefined' ? 0 : window.innerHeight,
  }));

  useLayoutEffect(() => {
    if (!target) {
      setTargetRect(null);
      return undefined;
    }

    let frameId = null;
    let resizeObserver = null;

    const updateTargetRect = () => {
      if (!target || !target.isConnected) {
        setTargetRect(null);
        return;
      }

      setViewportSize((previous) => {
        const next = {
          width: window.innerWidth,
          height: window.innerHeight,
        };
        if (
          previous.width === next.width &&
          previous.height === next.height
        ) {
          return previous;
        }
        return next;
      });

      const nextRect = target.getBoundingClientRect();
      if (nextRect.width <= 0 || nextRect.height <= 0) {
        setTargetRect(null);
        return;
      }

      setTargetRect((previous) => {
        if (
          previous &&
          previous.top === nextRect.top &&
          previous.left === nextRect.left &&
          previous.width === nextRect.width &&
          previous.height === nextRect.height
        ) {
          return previous;
        }
        return nextRect;
      });
    };

    const scheduleTargetRectUpdate = () => {
      if (frameId !== null) {
        return;
      }
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        updateTargetRect();
      });
    };

    updateTargetRect();
    window.addEventListener('resize', scheduleTargetRectUpdate);
    window.addEventListener('scroll', scheduleTargetRectUpdate, true);
    document.addEventListener('transitionrun', scheduleTargetRectUpdate, true);
    document.addEventListener('transitionend', scheduleTargetRectUpdate, true);
    document.addEventListener('transitioncancel', scheduleTargetRectUpdate, true);
    document.addEventListener('animationstart', scheduleTargetRectUpdate, true);
    document.addEventListener('animationend', scheduleTargetRectUpdate, true);

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        scheduleTargetRectUpdate();
      });

      if (isElementTarget(target)) {
        resizeObserver.observe(target);
      }

      if (document.documentElement) {
        resizeObserver.observe(document.documentElement);
      }
    }

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      resizeObserver?.disconnect();
      window.removeEventListener('resize', scheduleTargetRectUpdate);
      window.removeEventListener('scroll', scheduleTargetRectUpdate, true);
      document.removeEventListener('transitionrun', scheduleTargetRectUpdate, true);
      document.removeEventListener('transitionend', scheduleTargetRectUpdate, true);
      document.removeEventListener(
        'transitioncancel',
        scheduleTargetRectUpdate,
        true,
      );
      document.removeEventListener('animationstart', scheduleTargetRectUpdate, true);
      document.removeEventListener('animationend', scheduleTargetRectUpdate, true);
    };
  }, [target]);

  useLayoutEffect(() => {
    if (!cardRef.current) return undefined;

    const updateCardSize = () => {
      if (!cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      setCardSize((previous) => {
        if (previous.width === rect.width && previous.height === rect.height) {
          return previous;
        }
        return {
          width: rect.width,
          height: rect.height,
        };
      });
    };

    updateCardSize();

    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver(updateCardSize);
    observer.observe(cardRef.current);

    return () => observer.disconnect();
  }, [guide?.id, guide?.maxWidth, viewportSize.height, viewportSize.width]);

  useLayoutEffect(() => {
    setPlacementOverride(null);
  }, [guide?.id]);

  const spotlightRect = useMemo(() => {
    if (!targetRect) return null;
    return getSpotlightRect(targetRect, guide?.spotlightPadding ?? 0);
  }, [guide?.spotlightPadding, targetRect]);

  const cardWidth = useMemo(
    () => Math.min(guide?.maxWidth ?? 420, viewportSize.width - 24),
    [guide?.maxWidth, viewportSize.width],
  );

  const cardPosition = useMemo(() => {
    if (!spotlightRect) return null;
    return getCardPosition(
      spotlightRect,
      {
        ...cardSize,
        width: cardWidth,
      },
      {
        name: placementOverride || guide?.placement || 'bottom',
        offset: guide?.offset ?? 16,
      },
    );
  }, [
    cardSize,
    cardWidth,
    guide?.offset,
    guide?.placement,
    placementOverride,
    spotlightRect,
    viewportSize.height,
    viewportSize.width,
  ]);

  useLayoutEffect(() => {
    if (!cardRef.current || !spotlightRect) return;

    const rect = cardRef.current.getBoundingClientRect();
    const overflowTop = VIEWPORT_MARGIN - rect.top;
    const overflowBottom = rect.bottom - (viewportSize.height - VIEWPORT_MARGIN);
    const overflowLeft = VIEWPORT_MARGIN - rect.left;
    const overflowRight = rect.right - (viewportSize.width - VIEWPORT_MARGIN);

    let nextPlacementOverride = placementOverride;

    if (overflowBottom > 0 || overflowTop > 0) {
      const spaceAbove = spotlightRect.rawTop - VIEWPORT_MARGIN;
      const spaceBelow =
        viewportSize.height - spotlightRect.rawBottom - VIEWPORT_MARGIN;

      if (
        overflowBottom > 0 &&
        spaceAbove >= rect.height + MIN_CARD_EDGE_CLEARANCE
      ) {
        nextPlacementOverride = 'top';
      } else if (
        overflowTop > 0 &&
        spaceBelow >= rect.height + MIN_CARD_EDGE_CLEARANCE
      ) {
        nextPlacementOverride = 'bottom';
      } else if (spaceAbove > spaceBelow && spaceAbove > 0) {
        nextPlacementOverride = 'top';
      } else if (spaceBelow > 0) {
        nextPlacementOverride = 'bottom';
      }
    } else if (overflowRight > 0 || overflowLeft > 0) {
      const spaceAbove = spotlightRect.rawTop - VIEWPORT_MARGIN;
      const spaceBelow =
        viewportSize.height - spotlightRect.rawBottom - VIEWPORT_MARGIN;
      const spaceLeft = spotlightRect.rawLeft - VIEWPORT_MARGIN;
      const spaceRight =
        viewportSize.width - spotlightRect.rawRight - VIEWPORT_MARGIN;

      if (spaceBelow >= rect.height + MIN_CARD_EDGE_CLEARANCE) {
        nextPlacementOverride = 'bottom';
      } else if (spaceAbove >= rect.height + MIN_CARD_EDGE_CLEARANCE) {
        nextPlacementOverride = 'top';
      } else if (overflowRight > 0 && spaceLeft > spaceRight) {
        nextPlacementOverride = 'left';
      } else if (overflowLeft > 0 && spaceRight > spaceLeft) {
        nextPlacementOverride = 'right';
      }
    }

    if (nextPlacementOverride !== placementOverride) {
      setPlacementOverride(nextPlacementOverride);
    }
  }, [cardPosition, placementOverride, spotlightRect, viewportSize.height, viewportSize.width]);

  if (
    !guide ||
    !target ||
    !targetRect ||
    !spotlightRect ||
    !cardPosition ||
    typeof document === 'undefined'
  ) {
    return null;
  }

  const arrowPosition = getArrowPosition(cardPosition.placement, spotlightRect, {
    top: cardPosition.top,
    left: cardPosition.left,
    width: cardWidth,
    height: cardSize.height,
  });
  const maskLeft = Math.floor(spotlightRect.left);
  const maskTop = Math.floor(spotlightRect.top);
  const maskRight = Math.ceil(spotlightRect.right);
  const maskBottom = Math.ceil(spotlightRect.bottom);
  const maskPath = [
    `M0 0H${viewportSize.width}V${viewportSize.height}H0Z`,
    `M${maskLeft} ${maskTop}H${maskRight}V${maskBottom}H${maskLeft}Z`,
  ].join(' ');

  return createPortal(
    <div className='onboarding-overlay-root' role='presentation'>
      <svg
        className='onboarding-mask-svg'
        viewBox={`0 0 ${viewportSize.width} ${viewportSize.height}`}
        preserveAspectRatio='none'
        aria-hidden='true'
      >
        <path d={maskPath} fillRule='evenodd' />
      </svg>

      <div
        className='onboarding-spotlight'
        style={{
          top: spotlightRect.top,
          left: spotlightRect.left,
          width: spotlightRect.width,
          height: spotlightRect.height,
        }}
      />

      <div
        ref={cardRef}
        className={`onboarding-card onboarding-card-${cardPosition.placement}`}
        style={{
          top: cardPosition.bottom != null ? 'auto' : cardPosition.top,
          left: cardPosition.right != null ? 'auto' : cardPosition.left,
          bottom: cardPosition.bottom != null ? cardPosition.bottom : 'auto',
          right: cardPosition.right != null ? cardPosition.right : 'auto',
          width: cardWidth,
        }}
        role='dialog'
        aria-modal='true'
        aria-labelledby='onboarding-guide-title'
      >
        <div
          className='onboarding-card-arrow'
          style={{
            top: arrowPosition.top,
            left: arrowPosition.left,
          }}
        />
        <Title heading={6} id='onboarding-guide-title' className='!mb-2'>
          {guide.titleKey
            ? t(guide.titleKey)
            : guide.title || t('onboarding.title')}
        </Title>
        {(guide.descriptionKey || guide.description) && (
          <Text className='onboarding-card-description'>
            {guide.descriptionKey ? t(guide.descriptionKey) : guide.description}
          </Text>
        )}

        <Space className='onboarding-card-actions'>
          <Button type='tertiary' onClick={onDismissAll}>
            {t('onboarding.dismissAll')}
          </Button>
          <Button
            type='primary'
            theme='solid'
            className='onboarding-confirm-button'
            onClick={onConfirm}
          >
            {t('onboarding.confirm')}
          </Button>
        </Space>
      </div>
    </div>,
    document.body,
  );
};

export default OnboardingOverlay;

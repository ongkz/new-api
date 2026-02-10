package service

import "testing"

func TestIsInDailyWindow_SameStartEndIsAllDay(t *testing.T) {
	for _, now := range []int{0, 1, 60, 720, 1439} {
		if !isInDailyWindow(now, 0, 0) {
			t.Fatalf("expected all-day window when start==end, now=%d", now)
		}
		if !isInDailyWindow(now, 123, 123) {
			t.Fatalf("expected all-day window when start==end, now=%d", now)
		}
	}
}

func TestIsInDailyWindow_NormalWindow(t *testing.T) {
	start := 9 * 60  // 09:00
	end := 12 * 60   // 12:00
	in := []int{540, 600, 719}    // 09:00, 10:00, 11:59
	out := []int{0, 539, 720, 800} // 00:00, 08:59, 12:00, 13:20

	for _, now := range in {
		if !isInDailyWindow(now, start, end) {
			t.Fatalf("expected in window, now=%d", now)
		}
	}
	for _, now := range out {
		if isInDailyWindow(now, start, end) {
			t.Fatalf("expected out of window, now=%d", now)
		}
	}
}

func TestIsInDailyWindow_CrossDayWindow(t *testing.T) {
	start := 23 * 60 // 23:00
	end := 2 * 60    // 02:00

	in := []int{1380, 1439, 0, 60, 119} // 23:00, 23:59, 00:00, 01:00, 01:59
	out := []int{120, 600, 1379}        // 02:00, 10:00, 22:59

	for _, now := range in {
		if !isInDailyWindow(now, start, end) {
			t.Fatalf("expected in cross-day window, now=%d", now)
		}
	}
	for _, now := range out {
		if isInDailyWindow(now, start, end) {
			t.Fatalf("expected out of cross-day window, now=%d", now)
		}
	}
}


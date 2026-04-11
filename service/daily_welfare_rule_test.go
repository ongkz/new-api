package service

import "testing"

func TestIsInDailyWindow(t *testing.T) {
	// Normal window
	if !isInDailyWindow(60, 60, 120) {
		t.Fatalf("expected hit at start")
	}
	if !isInDailyWindow(119, 60, 120) {
		t.Fatalf("expected hit before end")
	}
	if isInDailyWindow(120, 60, 120) {
		t.Fatalf("expected miss at end (exclusive)")
	}

	// Cross-day window 23:00-02:00
	start := 23 * 60
	end := 2 * 60
	if !isInDailyWindow(start, start, end) {
		t.Fatalf("expected hit at 23:00")
	}
	if !isInDailyWindow(1*60, start, end) {
		t.Fatalf("expected hit at 01:00")
	}
	if isInDailyWindow(3*60, start, end) {
		t.Fatalf("expected miss at 03:00")
	}

	// start == end => all day
	if !isInDailyWindow(0, 0, 0) || !isInDailyWindow(1439, 0, 0) {
		t.Fatalf("expected all-day hit when start==end")
	}
}

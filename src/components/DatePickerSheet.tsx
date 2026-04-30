import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DatePickerSheetProps {
  selectedDate: string; // dd/mm/yyyy
  onSelect: (date: string) => void;
  onClose: () => void;
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function parseDDMMYYYY(str: string): Date {
  const [d, m, y] = str.split('/').map(Number);
  return new Date(y, m - 1, d);
}

function formatDD_MM(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatDDMMYYYY(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

export const DatePickerSheet: React.FC<DatePickerSheetProps> = ({
  selectedDate,
  onSelect,
  onClose,
}) => {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const yesterday = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return d;
  }, [today]);

  const dayBefore = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 2);
    return d;
  }, [today]);

  const selected = useMemo(() => parseDDMMYYYY(selectedDate), [selectedDate]);

  const [viewYear, setViewYear] = useState(selected.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected.getMonth());

  // Is viewing current month?
  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  // Calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const startWeekday = firstDay.getDay(); // 0=Sun
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const days: Array<{ day: number; date: Date; isCurrentMonth: boolean }> = [];

    // Empty slots before first day
    for (let i = 0; i < startWeekday; i++) {
      days.push({ day: 0, date: new Date(0), isCurrentMonth: false });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ day: d, date: new Date(viewYear, viewMonth, d), isCurrentMonth: true });
    }

    return days;
  }, [viewYear, viewMonth]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (isCurrentMonth) return;
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDate = (date: Date) => {
    onSelect(formatDDMMYYYY(date));
    onClose();
  };

  const shortcuts = [
    { label: 'Hoje', date: today },
    { label: 'Ontem', date: yesterday },
    { label: 'Anteontem', date: dayBefore },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet datepicker-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-sheet__handle" />

        {/* Shortcuts */}
        <div className="datepicker-shortcuts">
          {shortcuts.map((s) => {
            const isActive = isSameDay(selected, s.date);
            return (
              <button
                key={s.label}
                className={`datepicker-shortcut ${isActive ? 'datepicker-shortcut--active' : ''}`}
                onClick={() => handleSelectDate(s.date)}
                type="button"
              >
                <span className="datepicker-shortcut__label">{s.label}</span>
                <span className="datepicker-shortcut__date">{formatDD_MM(s.date)}</span>
              </button>
            );
          })}
        </div>

        {/* Month navigation */}
        <div className="datepicker-nav">
          <button className="datepicker-nav__btn" onClick={handlePrevMonth} type="button">
            <ChevronLeft size={18} />
          </button>
          <span className="datepicker-nav__title">
            {MONTHS[viewMonth]} {viewYear}
          </span>
          <button
            className={`datepicker-nav__btn ${isCurrentMonth ? 'datepicker-nav__btn--disabled' : ''}`}
            onClick={handleNextMonth}
            disabled={isCurrentMonth}
            type="button"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Weekday headers */}
        <div className="datepicker-grid">
          {WEEKDAYS.map((w) => (
            <div key={w} className="datepicker-weekday">{w}</div>
          ))}

          {/* Days */}
          {calendarDays.map((slot, i) => {
            if (!slot.isCurrentMonth) {
              return <div key={`empty-${i}`} className="datepicker-day datepicker-day--empty" />;
            }

            const isFuture = slot.date > today;
            const isToday = isSameDay(slot.date, today);
            const isSelected = isSameDay(slot.date, selected);

            let cls = 'datepicker-day';
            if (isFuture) cls += ' datepicker-day--disabled';
            else if (isSelected) cls += ' datepicker-day--selected';
            else if (isToday) cls += ' datepicker-day--today';

            return (
              <button
                key={`day-${slot.day}`}
                className={cls}
                onClick={() => !isFuture && handleSelectDate(slot.date)}
                disabled={isFuture}
                type="button"
              >
                {slot.day}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

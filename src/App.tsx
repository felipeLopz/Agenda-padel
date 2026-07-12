import { useEffect, useState } from 'react';
import { AgendaProvider } from './state/AgendaContext';
import { AuthProvider, useAuth } from './state/AuthContext';
import AuthScreen from './components/AuthScreen';
import { STORAGE_KEY } from './lib/constants';
import Header, { type ViewMode } from './components/Header';
import TodayView from './components/TodayView';
import AnnualView from './components/AnnualView';
import WeeklyView from './components/WeeklyView';
import StudentsView from './components/StudentsView';
import FinanceView from './components/FinanceView';
import StatsView from './components/StatsView';
import DayAgendaModal from './components/DayAgendaModal';
import ClassFormModal from './components/ClassFormModal';
import GlobalSearchModal from './components/GlobalSearchModal';
import SettingsModal from './components/SettingsModal';
import StudentProfileModal from './components/StudentProfileModal';
import StudentFormModal from './components/StudentFormModal';
import PaymentFormModal from './components/PaymentFormModal';
import MoveClassModal from './components/MoveClassModal';
import DuplicateClassModal from './components/DuplicateClassModal';
import CopyWeekModal from './components/CopyWeekModal';
import BlockDayModal from './components/BlockDayModal';
import UndoToast from './components/UndoToast';
import ExportReminder from './components/ExportReminder';
import Skeletons from './components/Skeletons';
import SyncCheck from './components/SyncCheck';
import Spinner from './components/Spinner';
import ReminderEditModal from './components/ReminderEditModal';
import RepeatClassModal from './components/RepeatClassModal';
import RemindersPanel from './components/RemindersPanel';
import FabMenu from './components/FabMenu';
import Confetti from './components/Confetti';
import { useReminders } from './hooks/useReminders';
import { DialogProvider } from './state/DialogContext';
import { useAgenda } from './state/AgendaContext';
import { dayKey, startOfWeek } from './lib/date';
import { loadUiState, saveUiState } from './lib/uiState';
import type { ClassEntry, ClassFormTarget, Student } from './types';

/** Orquesta qué vista y qué modal está abierto; el estado de datos vive en AgendaContext. */
function AppShell() {
  const { initialLoading, data } = useAgenda();
  const { due, upcoming, dueCount } = useReminders();
  // Vista inicial: la última usada en este dispositivo (restaurada al recargar) o "Hoy".
  const [view, setView] = useState<ViewMode>(() => loadUiState().view ?? 'hoy');
  const [reminderTarget, setReminderTarget] = useState<{ day: string; start: number } | null>(null);
  // Turno a convertir en serie recurrente (desde la agenda del día o la edición).
  const [repeatTarget, setRepeatTarget] = useState<{ day: string; start: number } | null>(null);
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [newStudentOpen, setNewStudentOpen] = useState(false);
  const [year, setYear] = useState(() => loadUiState().year ?? new Date().getFullYear());
  const [weekAnchor, setWeekAnchor] = useState(() => {
    const ms = loadUiState().weekAnchorMs;
    return ms ? new Date(ms) : new Date();
  });
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [formTarget, setFormTarget] = useState<ClassFormTarget | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  // Pago abierto desde la agenda del día (atado a una clase, por inicio en minutos).
  const [payTarget, setPayTarget] = useState<{ studentId: string; classRef: { day: string; start: number } } | null>(
    null
  );
  const [moveTarget, setMoveTarget] = useState<{ day: string; start: number } | null>(null);
  const [duplicateTarget, setDuplicateTarget] = useState<{ day: string; start: number } | null>(null);
  const [copyWeekMonday, setCopyWeekMonday] = useState<Date | null>(null);
  const [blockDayKey, setBlockDayKey] = useState<string | null>(null);

  function openNewClass(day: string, start: number) {
    setFormTarget({ day, start, entry: null });
  }
  function openEditClass(day: string, start: number, entry: ClassEntry) {
    setFormTarget({ day, start, entry });
  }

  // Recuerda en el dispositivo la vista y el período abiertos, para restaurarlos al recargar.
  useEffect(() => {
    saveUiState({ view, year, weekAnchorMs: weekAnchor.getTime() });
  }, [view, year, weekAnchor]);

  return (
    <div className="app">
      <Header
        view={view}
        onChangeView={setView}
        year={year}
        onChangeYear={setYear}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        reminderCount={dueCount}
        onOpenReminders={() => setRemindersOpen(true)}
      />

      <ExportReminder />

      <main className="app__content">
        {initialLoading && Object.keys(data.days).length === 0 && Object.keys(data.students).length === 0 ? (
          <Skeletons />
        ) : (
          // `key={view}` remonta el contenido al cambiar de pestaña → transición suave.
          <div className="view-anim" key={view}>
            {view === 'hoy' && (
              <TodayView
                onOpenClass={(start, entry) => openEditClass(dayKey(new Date()), start, entry)}
                onNewClass={(start) => openNewClass(dayKey(new Date()), start)}
              />
            )}
            {view === 'anual' && <AnnualView year={year} onOpenDay={setOpenDay} />}
            {view === 'semanal' && (
              <WeeklyView
                anchor={weekAnchor}
                onChangeAnchor={setWeekAnchor}
                onOpenNewClass={openNewClass}
                onOpenEditClass={openEditClass}
                onOpenCopyWeek={(fromMonday) => setCopyWeekMonday(fromMonday)}
                onBlockDay={(day) => setBlockDayKey(day)}
              />
            )}
            {view === 'alumnos' && <StudentsView onOpenDay={setOpenDay} />}
            {view === 'caja' && <FinanceView onOpenStudent={setProfileId} />}
            {view === 'stats' && <StatsView onGoCaja={() => setView('caja')} />}
          </div>
        )}
      </main>

      {openDay && (
        <DayAgendaModal
          day={openDay}
          onClose={() => setOpenDay(null)}
          onNewClass={(start) => openNewClass(openDay, start)}
          onEditClass={(start, entry) => openEditClass(openDay, start, entry)}
          onRegisterPayment={(studentId, classRef) => setPayTarget({ studentId, classRef })}
          onMoveClass={(start) => setMoveTarget({ day: openDay, start })}
          onDuplicateClass={(start) => setDuplicateTarget({ day: openDay, start })}
          onReminder={(start) => setReminderTarget({ day: openDay, start })}
          onRepeat={(start) => setRepeatTarget({ day: openDay, start })}
          onBlockDay={() => setBlockDayKey(openDay)}
        />
      )}

      {formTarget && (
        <ClassFormModal
          target={formTarget}
          onClose={() => setFormTarget(null)}
          onReminder={() => setReminderTarget({ day: formTarget.day, start: formTarget.start })}
          onRepeat={() => {
            // Se cierra el form antes de abrir "Repetir": así un guardado posterior del form
            // (con su copia vieja del turno, sin seriesId) no puede desvincular la serie recién
            // creada. "Repetir" opera sobre el turno tal como está guardado.
            setRepeatTarget({ day: formTarget.day, start: formTarget.start });
            setFormTarget(null);
          }}
        />
      )}

      {searchOpen && (
        <GlobalSearchModal
          onClose={() => setSearchOpen(false)}
          onOpenStudent={(id) => {
            setSearchOpen(false);
            setProfileId(id);
          }}
          onOpenDay={(day) => {
            setSearchOpen(false);
            setOpenDay(day);
          }}
        />
      )}

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}

      {profileId && (
        <StudentProfileModal
          studentId={profileId}
          onClose={() => setProfileId(null)}
          onEdit={(student) => setEditStudent(student)}
          onOpenDay={(day) => {
            setProfileId(null);
            setOpenDay(day);
          }}
        />
      )}

      {editStudent && <StudentFormModal student={editStudent} onClose={() => setEditStudent(null)} />}

      {newStudentOpen && (
        <StudentFormModal
          student={null}
          onClose={() => setNewStudentOpen(false)}
          onSaved={(s) => {
            setNewStudentOpen(false);
            setProfileId(s.id);
          }}
        />
      )}

      {payTarget && (
        <PaymentFormModal
          studentId={payTarget.studentId}
          classRef={payTarget.classRef}
          onClose={() => setPayTarget(null)}
        />
      )}

      {moveTarget && <MoveClassModal from={moveTarget} onClose={() => setMoveTarget(null)} />}

      {duplicateTarget && (
        <DuplicateClassModal from={duplicateTarget} onClose={() => setDuplicateTarget(null)} />
      )}

      {copyWeekMonday && (
        <CopyWeekModal fromMonday={startOfWeek(copyWeekMonday)} onClose={() => setCopyWeekMonday(null)} />
      )}

      {blockDayKey && <BlockDayModal day={blockDayKey} onClose={() => setBlockDayKey(null)} />}

      {reminderTarget && (
        <ReminderEditModal
          day={reminderTarget.day}
          start={reminderTarget.start}
          onClose={() => setReminderTarget(null)}
        />
      )}

      {repeatTarget && (
        <RepeatClassModal day={repeatTarget.day} start={repeatTarget.start} onClose={() => setRepeatTarget(null)} />
      )}

      {remindersOpen && (
        <RemindersPanel due={due} upcoming={upcoming} onOpenDay={setOpenDay} onClose={() => setRemindersOpen(false)} />
      )}

      <FabMenu onNewClass={() => setOpenDay(dayKey(new Date()))} onNewStudent={() => setNewStudentOpen(true)} />

      <UndoToast />
      <SyncCheck />
      <Confetti />
    </div>
  );
}

/** Portero (Tanda 6): sin sesión muestra el login; con sesión, la app sincronizada. */
function Root() {
  const { session, loading } = useAuth();

  // Aplica el tema guardado (claro/oscuro) también en el login, antes de cargar la app.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const theme = raw ? (JSON.parse(raw)?.settings?.theme as string | undefined) : undefined;
      document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
    } catch {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  if (loading) {
    return (
      <div className="auth-screen">
        <div className="auth-card auth-card--loading">
          <Spinner label="Cargando…" />
        </div>
      </div>
    );
  }

  if (!session) return <AuthScreen />;

  return (
    <AgendaProvider>
      <AppShell />
    </AgendaProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      {/* Avisos/confirmaciones propios (reemplazan los alert()/confirm() del navegador). */}
      <DialogProvider>
        <Root />
      </DialogProvider>
    </AuthProvider>
  );
}

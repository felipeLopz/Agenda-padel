import { useState } from 'react';
import { AgendaProvider } from './state/AgendaContext';
import Header, { type ViewMode } from './components/Header';
import AnnualView from './components/AnnualView';
import WeeklyView from './components/WeeklyView';
import StudentsView from './components/StudentsView';
import FinanceView from './components/FinanceView';
import DayAgendaModal from './components/DayAgendaModal';
import ClassFormModal from './components/ClassFormModal';
import SearchStudentModal from './components/SearchStudentModal';
import SettingsModal from './components/SettingsModal';
import StudentProfileModal from './components/StudentProfileModal';
import StudentFormModal from './components/StudentFormModal';
import PaymentFormModal from './components/PaymentFormModal';
import type { ClassEntry, ClassFormTarget, Student } from './types';

/** Orquesta qué vista y qué modal está abierto; el estado de datos vive en AgendaContext. */
function AppShell() {
  const [view, setView] = useState<ViewMode>('anual');
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [weekAnchor, setWeekAnchor] = useState(() => new Date());
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [formTarget, setFormTarget] = useState<ClassFormTarget | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  // Pago abierto desde la agenda del día (atado a una clase).
  const [payTarget, setPayTarget] = useState<{ studentId: string; classRef: { day: string; hour: number } } | null>(
    null
  );

  function openNewClass(day: string, hour: number) {
    setFormTarget({ day, hour, entry: null });
  }
  function openEditClass(day: string, hour: number, entry: ClassEntry) {
    setFormTarget({ day, hour, entry });
  }

  return (
    <div className="app">
      <Header
        view={view}
        onChangeView={setView}
        year={year}
        onChangeYear={setYear}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <main className="app__content">
        {view === 'anual' && <AnnualView year={year} onOpenDay={setOpenDay} />}
        {view === 'semanal' && (
          <WeeklyView
            anchor={weekAnchor}
            onChangeAnchor={setWeekAnchor}
            onOpenNewClass={openNewClass}
            onOpenEditClass={openEditClass}
          />
        )}
        {view === 'alumnos' && <StudentsView onOpenDay={setOpenDay} />}
        {view === 'caja' && <FinanceView onOpenStudent={setProfileId} />}
      </main>

      {openDay && (
        <DayAgendaModal
          day={openDay}
          onClose={() => setOpenDay(null)}
          onNewClass={(hour) => openNewClass(openDay, hour)}
          onEditClass={(hour, entry) => openEditClass(openDay, hour, entry)}
          onRegisterPayment={(studentId, classRef) => setPayTarget({ studentId, classRef })}
        />
      )}

      {formTarget && <ClassFormModal target={formTarget} onClose={() => setFormTarget(null)} />}

      {searchOpen && (
        <SearchStudentModal
          onClose={() => setSearchOpen(false)}
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

      {payTarget && (
        <PaymentFormModal
          studentId={payTarget.studentId}
          classRef={payTarget.classRef}
          onClose={() => setPayTarget(null)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AgendaProvider>
      <AppShell />
    </AgendaProvider>
  );
}

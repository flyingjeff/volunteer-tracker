"use client";

import { Check, Pencil, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui";
import type { VolunteerProfile, VolunteerTask, TaskStatus } from "@/lib/types";

const columns: Array<{ status: TaskStatus; label: string }> = [
  { status: "todo", label: "To do" },
  { status: "in-progress", label: "In progress" },
  { status: "complete", label: "Complete" }
];

export function KanbanBoard({
  tasks,
  volunteers,
  onStatusChange,
  onDelete,
  onEdit,
  onAssign
}: {
  tasks: VolunteerTask[];
  volunteers: VolunteerProfile[];
  onStatusChange: (task: VolunteerTask, status: TaskStatus) => void;
  onDelete: (taskId: string) => void;
  onEdit: (task: VolunteerTask) => void;
  onAssign: (task: VolunteerTask, volunteerId: string) => void;
}) {
  const volunteerName = (id: string) => {
    const volunteer = volunteers.find((item) => item.id === id);
    return volunteer ? `${volunteer.firstName} ${volunteer.lastName}` : "Unknown";
  };

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {columns.map((column) => (
        <section key={column.status} className="min-h-64 rounded-lg border border-ink/10 bg-white p-3 shadow-soft">
          <div className="flex items-center justify-between">
            <h3 className="font-black">{column.label}</h3>
            <span className="rounded bg-paper px-2 py-1 text-xs font-bold text-ink/60">
              {tasks.filter((task) => task.status === column.status).length}
            </span>
          </div>

          <div className="mt-3 grid gap-3">
            {tasks
              .filter((task) => task.status === column.status)
              .map((task) => (
                <article key={task.id} className="rounded-md border border-ink/10 bg-paper p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-black">{task.title}</h4>
                      <p className="mt-1 text-sm leading-6 text-ink/70">{task.description || "No description"}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button className="min-h-9 bg-white px-2 text-ink" title="Edit task" onClick={() => onEdit(task)}>
                        <Pencil size={15} />
                      </Button>
                      <Button className="min-h-9 bg-white px-2 text-clay" title="Delete task" onClick={() => onDelete(task.id)}>
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  </div>

                  {task.skillTags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {task.skillTags.map((skill) => (
                        <span key={skill} className="rounded bg-white px-2 py-1 text-xs font-bold text-moss">
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 grid gap-2">
                    <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.12em] text-ink/50">
                      Assign
                      <select
                        className="focus-ring min-h-10 rounded-md border border-ink/10 bg-white px-2 text-sm font-semibold normal-case tracking-normal text-ink"
                        value=""
                        onChange={(event) => {
                          if (event.target.value) onAssign(task, event.target.value);
                        }}
                      >
                        <option value="">Choose volunteer</option>
                        {volunteers.map((volunteer) => (
                          <option key={volunteer.id} value={volunteer.id}>
                            {volunteer.firstName} {volunteer.lastName}
                          </option>
                        ))}
                      </select>
                    </label>
                    {task.assignedVolunteerIds.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {task.assignedVolunteerIds.map((id) => (
                          <span key={id} className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 text-xs font-bold text-ink/70">
                            <UserPlus size={12} />
                            {volunteerName(id)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {column.status !== "in-progress" && (
                      <Button className="min-h-9 bg-moss px-3 text-white" onClick={() => onStatusChange(task, "in-progress")}>
                        Start
                      </Button>
                    )}
                    {column.status !== "complete" && (
                      <Button className="min-h-9 bg-gold px-3 text-ink" onClick={() => onStatusChange(task, "complete")}>
                        <Check size={15} />
                        Complete
                      </Button>
                    )}
                  </div>
                </article>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

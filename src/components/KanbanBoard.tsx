"use client";

import { Check, Pencil, Trash2, UserMinus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui";
import type { VolunteerProfile, VolunteerTask, TaskStatus, TaskLocation } from "@/lib/types";

const columns: Array<{ status: TaskStatus; label: string }> = [
  { status: "todo", label: "To do" },
  { status: "in-progress", label: "In progress" },
  { status: "complete", label: "Complete" }
];

export function KanbanBoard({
  tasks,
  volunteers,
  locations,
  onStatusChange,
  onDelete,
  onEdit,
  onAssigneesChange
}: {
  tasks: VolunteerTask[];
  volunteers: VolunteerProfile[];
  locations: TaskLocation[];
  onStatusChange: (task: VolunteerTask, status: TaskStatus) => void;
  onDelete: (taskId: string) => void;
  onEdit: (task: VolunteerTask) => void;
  onAssigneesChange: (task: VolunteerTask, volunteerIds: string[]) => void;
}) {
  const volunteerName = (id: string) => {
    const volunteer = volunteers.find((item) => item.id === id);
    return volunteer ? `${volunteer.firstName} ${volunteer.lastName}` : "Unknown";
  };

  const hasMultipleFloors = new Set(locations.map((location) => location.floor).filter(Boolean)).size > 1;
  const locationLabel = (task: VolunteerTask) =>
    [hasMultipleFloors ? task.locationFloor : "", task.locationZone, task.locationName].filter(Boolean).join(" - ");

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
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {task.taskLeaderName && (
                          <span className="rounded bg-gold px-2 py-1 text-xs font-black text-ink">
                            Lead: {task.taskLeaderName}
                          </span>
                        )}
                        {locationLabel(task) && (
                          <span className="rounded bg-white px-2 py-1 text-xs font-bold text-ink/65">{locationLabel(task)}</span>
                        )}
                      </div>
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
                    <div className="grid gap-2">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink/50">Assign volunteers</p>
                      <div className="grid max-h-44 gap-1 overflow-auto rounded-md border border-ink/10 bg-white p-2">
                        {volunteers.length === 0 ? (
                          <p className="p-2 text-sm font-semibold text-ink/55">No volunteers yet.</p>
                        ) : (
                          volunteers.map((volunteer) => {
                            const checked = task.assignedVolunteerIds.includes(volunteer.id);
                            return (
                              <label key={volunteer.id} className="flex min-h-9 items-center gap-2 rounded px-2 text-sm font-semibold text-ink">
                                <input
                                  className="h-4 w-4 accent-moss"
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(event) => {
                                    const nextIds = event.target.checked
                                      ? Array.from(new Set([...task.assignedVolunteerIds, volunteer.id]))
                                      : task.assignedVolunteerIds.filter((id) => id !== volunteer.id);
                                    onAssigneesChange(task, nextIds);
                                  }}
                                />
                                {volunteer.firstName} {volunteer.lastName}
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>
                    {task.assignedVolunteerIds.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {task.assignedVolunteerIds.map((id) => (
                          <button
                            key={id}
                            className="focus-ring inline-flex items-center gap-1 rounded bg-white px-2 py-1 text-xs font-bold text-ink/70"
                            onClick={() => onAssigneesChange(task, task.assignedVolunteerIds.filter((volunteerId) => volunteerId !== id))}
                            title="Remove volunteer"
                          >
                            <UserPlus size={12} />
                            {volunteerName(id)}
                            <UserMinus size={12} />
                          </button>
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

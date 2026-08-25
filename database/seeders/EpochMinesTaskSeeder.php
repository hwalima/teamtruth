<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Task;
use App\Models\Project;
use App\Models\ProjectMilestone;
use App\Models\TaskStage;
use App\Models\User;

class EpochMinesTaskSeeder extends Seeder
{
    public function run(): void
    {
        $project = Project::where('id', 1)->first();
        if (!$project) {
            $this->command->error('Project Q4 2026 (ID 1) not found.');
            return;
        }

        $user = User::where('email', 'knkomo@trukumbmining.africa')->first();
        if (!$user) {
            $this->command->warn('User knkomo@trukumbmining.africa not found. Tasks will be unassigned.');
        }

        $milestone = ProjectMilestone::firstOrCreate(
            ['project_id' => $project->id, 'title' => 'Epoch Mines'],
            [
                'description' => 'Gold processing plant operations and maintenance tasks',
                'status' => 'in_progress',
                'progress' => 0,
                'order' => 0,
                'created_by' => $user ? $user->id : 1,
            ]
        );

        $workspace = $project->workspace;
        $toDoStage = TaskStage::where('workspace_id', $workspace->id)
            ->orderBy('order')
            ->first();

        if (!$toDoStage) {
            $this->command->error('No task stages found for workspace.');
            return;
        }

        $createdBy = $user ? $user->id : 1;
        $assignedTo = $user ? $user->id : null;

        $tasks = [
            [
                'title' => 'Achieve Daily & Weekly Production Targets',
                'description' => 'Process 60 t/day (420 t/week cumulative) of ore to produce 96 g/day of gold, meeting the strategic weekly total of 672 g poured and secured by Sunday morning.',
                'priority' => 'high',
                'start_date' => '2026-08-25',
                'end_date' => '2026-08-31',
            ],
            [
                'title' => 'Maintain Metallurgical & Operating KPIs',
                'description' => 'Maintain an 80% CIL metallurgical recovery rate, 80% passing 75 µm grind fineness, and pulp density within the 43%–52% operating band.',
                'priority' => 'high',
                'start_date' => '2026-08-25',
                'end_date' => '2026-08-31',
            ],
            [
                'title' => 'Execute Sample Collection & Dispatch',
                'description' => 'Collect and dispatch samples at least three (3) times per week (Monday, Wednesday, and Friday).',
                'priority' => 'medium',
                'start_date' => '2026-08-25',
                'end_date' => '2026-08-31',
            ],
            [
                'title' => 'Daily Concentrator Flashing',
                'description' => 'Perform daily morning flashing of the concentrator at 07:00 hrs.',
                'priority' => 'medium',
                'start_date' => '2026-08-25',
                'end_date' => '2026-08-31',
            ],
            [
                'title' => 'Bi-Daily Smelting Clean-Up',
                'description' => 'Conduct complete plant clean-up for smelting every 2 days.',
                'priority' => 'high',
                'start_date' => '2026-08-25',
                'end_date' => '2026-08-31',
            ],
            [
                'title' => 'Maintain Crushing & Milling Throughput',
                'description' => 'Maintain a crushing/milling throughput target of 2.5 t to 3.0 t/hour, specifically targeting 15 t/shift for Run-of-Mine (R.O.M) ore.',
                'priority' => 'medium',
                'start_date' => '2026-08-25',
                'end_date' => '2026-08-31',
            ],
            [
                'title' => 'Recircle Reef Effluents',
                'description' => 'Direct reef effluents from the ball mill into the D.I.Y pump and route back into the mill circuit.',
                'priority' => 'low',
                'start_date' => '2026-08-25',
                'end_date' => '2026-08-31',
            ],
            [
                'title' => 'Manage CIL & Vat Chemical Dosing',
                'description' => 'Dose chemical reagents: Cyanide CIL (12 × 50 kg bags/wk = 600 kg total), Cyanide Vat Leach (25 kg / 25 t ore per batch), Caustic Soda (5 bags/wk), Hydrogen Peroxide (15 L/day = 105 L/wk), and Lime (75 kg/day = 525 kg/wk).',
                'priority' => 'high',
                'start_date' => '2026-08-25',
                'end_date' => '2026-08-31',
            ],
            [
                'title' => 'Source & Apply Reagents (Verify Figures)',
                'description' => 'Source and apply Mercury (10 sachets/wk), Salt (10 kg / 2 weeks), Nitric Acid (5 × 20 L/wk), and Sulphuric Acid (1 unit/month, qty TBC). Verify figures and sulphuric acid unit of measure with metallurgical team prior to formal sign-off.',
                'priority' => 'medium',
                'start_date' => '2026-08-25',
                'end_date' => '2026-08-31',
            ],
            [
                'title' => 'V-Tank Scooping & Re-charging',
                'description' => 'Scoop and re-charge V-tanks (including silver-bearing tanks) at least 3 times per week (confirm exact frequency against source notes).',
                'priority' => 'high',
                'start_date' => '2026-08-25',
                'end_date' => '2026-08-31',
            ],
            [
                'title' => 'Restore Off-Line Leach Tank',
                'description' => 'Repair and restore off-line CIL leach tank #1 to service as a priority to achieve the 30-hour residence time target and secure the 672 g gold target.',
                'priority' => 'critical',
                'start_date' => '2026-08-25',
                'end_date' => '2026-08-25',
            ],
            [
                'title' => 'Shift Preventive Maintenance Checks',
                'description' => 'Perform daily routine machinery checks at the start of every shift; immediately log and escalate any identified abnormalities.',
                'priority' => 'high',
                'start_date' => '2026-08-25',
                'end_date' => '2026-08-31',
            ],
            [
                'title' => 'Procure Critical Lab Equipment',
                'description' => 'Procure 1x 75 µm aperture grind testing screen, 1x standard titration burette (cyanide strength testing), 1x pH meter, and 1x pulp density scale.',
                'priority' => 'high',
                'start_date' => '2026-08-25',
                'end_date' => '2026-08-25',
            ],
            [
                'title' => 'Procure Plant Consumables & Parts',
                'description' => 'Procure 2x 3-inch valves (confirm type), 1 tonne coconut shell granular activated carbon, and vibrating screen mesh panels: 1x 0.8 mm (2m × 3m), 1x 0.6 mm (2m × 2m), and 1x 0.5 mm (2m × 1m) (confirm panel sizes with plant team).',
                'priority' => 'high',
                'start_date' => '2026-08-25',
                'end_date' => '2026-08-25',
            ],
            [
                'title' => 'Action Slimes Dam Project',
                'description' => 'Proactively action the completed Bill of Quantities (B.O.Q.) for the Slimes Dam project before the onset of rains.',
                'priority' => 'high',
                'start_date' => '2026-08-25',
                'end_date' => '2026-08-25',
            ],
            [
                'title' => 'Procure Poles for Catwalk Support',
                'description' => 'Procure round poles (4 inch × 2m) as required to raise and secure the catwalk.',
                'priority' => 'medium',
                'start_date' => '2026-08-25',
                'end_date' => '2026-08-29',
            ],
            [
                'title' => 'Drop Pregnant Carbon & Charge Boilers',
                'description' => 'Perform dropping of pregnant carbon from the C.I.L circuit and execute charging of the boilers.',
                'priority' => 'high',
                'start_date' => '2026-08-25',
                'end_date' => '2026-08-31',
            ],
            [
                'title' => 'Migrate Eluted Carbon',
                'description' => 'Execute the migration of eluted carbon back into the leach tanks, effective from Monday.',
                'priority' => 'high',
                'start_date' => '2026-08-24',
                'end_date' => '2026-08-25',
            ],
        ];

        $count = 0;
        foreach ($tasks as $taskData) {
            Task::create([
                'project_id' => $project->id,
                'task_stage_id' => $toDoStage->id,
                'milestone_id' => $milestone->id,
                'title' => $taskData['title'],
                'description' => $taskData['description'],
                'priority' => $taskData['priority'],
                'start_date' => $taskData['start_date'],
                'end_date' => $taskData['end_date'],
                'assigned_to' => $assignedTo,
                'created_by' => $createdBy,
                'progress' => 0,
            ]);
            $count++;
        }

        $this->command->info("Successfully imported {$count} Epoch Mines tasks.");
    }
}

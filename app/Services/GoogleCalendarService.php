<?php

namespace App\Services;

use App\Models\Setting;
use Google_Client;
use Google_Service_Calendar;
use Google_Service_Calendar_Event;
use Google_Service_Calendar_EventDateTime;

class GoogleCalendarService
{
    private $client;
    private $service;

    public function __construct()
    {
        $this->client = new Google_Client();
        $this->service = new Google_Service_Calendar($this->client);
    }

    public function isEnabled($userId, $workspaceId = null)
    {
        $query = Setting::where('user_id', $userId)
            ->where('key', 'googleCalendarEnabled');

        if ($workspaceId) {
            $query->where('workspace_id', $workspaceId);
        }

        $enabled = $query->value('value');

        return $enabled === '1';
    }

    private function setupClient($userId, $workspaceId = null)
    {
        $query = Setting::where('user_id', $userId)
            ->where('key', 'googleCalendarJsonPath');

        if ($workspaceId) {
            $query->where('workspace_id', $workspaceId);
        }

        $jsonPath = $query->value('value');

        if (!$jsonPath) {
            throw new \Exception('Google Calendar JSON credentials not configured');
        }

        $paths = [
            $jsonPath,
            storage_path($jsonPath),
            storage_path('app/' . $jsonPath),
            storage_path('app/public/' . $jsonPath),
        ];

        $validPath = null;
        foreach ($paths as $path) {
            if (file_exists($path)) {
                $validPath = $path;
                break;
            }
        }

        if (!$validPath) {
            throw new \Exception('Google Calendar JSON file not found');
        }

        $this->client = new Google_Client();
        $this->client->setAuthConfig($validPath);
        $this->client->setScopes(Google_Service_Calendar::CALENDAR);
        $this->client->useApplicationDefaultCredentials();
        $this->service = new Google_Service_Calendar($this->client);
    }

    public function createEvent($item, $userId, $workspaceId = null)
    {
        if (!$this->isEnabled($userId, $workspaceId)) {
            return null;
        }
        
        try {
            $this->setupClient($userId, $workspaceId);
            if (!$this->service) {
                throw new \Exception('Google Calendar service not initialized');
            }
            
            // Handle Google Meeting
            if (isset($item->start_time) && isset($item->end_time)) {
                $event = new Google_Service_Calendar_Event([
                    'summary' => $item->title,
                    'description' => $item->description ?? '',
                    'extendedProperties' => [
                        'private' => [
                            'app_type' => 'google_meeting',
                            'app_id' => $item->id,
                            'app_user_id' => $userId
                        ]
                    ]
                ]);

                $start = new Google_Service_Calendar_EventDateTime();
                $start->setDateTime($item->start_time->format('c'));
                $event->setStart($start);

                $end = new Google_Service_Calendar_EventDateTime();
                $end->setDateTime($item->end_time->format('c'));
                $event->setEnd($end);
            } else {
                // Handle Task
                $event = new Google_Service_Calendar_Event([
                    'summary' => $item->title,
                    'description' => $item->description ?? '',
                    'extendedProperties' => [
                        'private' => [
                            'app_type' => 'task',
                            'app_id' => $item->id,
                            'app_user_id' => $userId
                        ]
                    ]
                ]);

                if ($item->start_date && $item->end_date) {
                    // Multi-day task: create all-day event spanning the date range
                    $start = new Google_Service_Calendar_EventDateTime();
                    $start->setDate($item->start_date->format('Y-m-d'));
                    $event->setStart($start);

                    $end = new Google_Service_Calendar_EventDateTime();
                    $end->setDate($item->end_date->copy()->addDay()->format('Y-m-d'));
                    $event->setEnd($end);
                } elseif ($item->end_date) {
                    // Single day task: create timed event on end_date
                    $startTime = $item->end_date->copy();
                    if ($startTime->format('H:i') === '00:00') {
                        $startTime->setTime(9, 0);
                    }
                    $endTime = $startTime->copy()->addHour();

                    $start = new Google_Service_Calendar_EventDateTime();
                    $start->setDateTime($startTime->format('c'));
                    $event->setStart($start);

                    $end = new Google_Service_Calendar_EventDateTime();
                    $end->setDateTime($endTime->format('c'));
                    $event->setEnd($end);
                } else {
                    return null;
                }
            }

            $query = Setting::where('user_id', $userId)
                ->where('key', 'googleCalendarId');

            if ($workspaceId) {
                $query->where('workspace_id', $workspaceId);
            }

            $calendarId = $query->value('value') ?: 'primary';
            
            try {
                $calendarEvent = $this->service->events->insert($calendarId, $event);
                return $calendarEvent->getId();
            } catch (\Exception $apiError) {
                \Log::warning('Google Calendar API error with custom calendar, trying primary', [
                    'error' => $apiError->getMessage(),
                    'calendar_id' => $calendarId
                ]);
                
                // Try with primary calendar as fallback
                try {
                    $calendarEvent = $this->service->events->insert('primary', $event);
                    return $calendarEvent->getId();
                } catch (\Exception $primaryError) {
                    throw new \Exception('Failed to create event in both custom and primary calendars: ' . $primaryError->getMessage());
                }
            }
        } catch (\Exception $e) {
            \Log::error('Google Calendar event creation failed: ' . $e->getMessage());
            return null;
        }
    }

    public function updateEvent($eventId, $item, $userId, $workspaceId = null)
    {
        if (!$this->isEnabled($userId, $workspaceId) || !$eventId) {
            return false;
        }

        try {
            $this->setupClient($userId, $workspaceId);
            if (!$this->service) {
                throw new \Exception('Google Calendar service not initialized');
            }

            $query = Setting::where('user_id', $userId)
                ->where('key', 'googleCalendarId');

            if ($workspaceId) {
                $query->where('workspace_id', $workspaceId);
            }

            $calendarId = $query->value('value') ?: 'primary';

            $event = $this->service->events->get($calendarId, $eventId);

            $event->setSummary($item->title);
            $event->setDescription($item->description ?? '');

            // Handle Google Meeting
            if (isset($item->start_time) && isset($item->end_time)) {
                $start = new Google_Service_Calendar_EventDateTime();
                $start->setDateTime($item->start_time->format('c'));
                $event->setStart($start);

                $end = new Google_Service_Calendar_EventDateTime();
                $end->setDateTime($item->end_time->format('c'));
                $event->setEnd($end);
            } else {
                // Handle Task
                if ($item->start_date && $item->end_date) {
                    // Multi-day task: create all-day event spanning the date range
                    $start = new Google_Service_Calendar_EventDateTime();
                    $start->setDate($item->start_date->format('Y-m-d'));
                    $event->setStart($start);

                    $end = new Google_Service_Calendar_EventDateTime();
                    $end->setDate($item->end_date->copy()->addDay()->format('Y-m-d'));
                    $event->setEnd($end);
                } elseif ($item->end_date) {
                    // Single day task: create timed event on end_date
                    $startTime = $item->end_date->copy();
                    if ($startTime->format('H:i') === '00:00') {
                        $startTime->setTime(9, 0);
                    }
                    $endTime = $startTime->copy()->addHour();

                    $start = new Google_Service_Calendar_EventDateTime();
                    $start->setDateTime($startTime->format('c'));
                    $event->setStart($start);

                    $end = new Google_Service_Calendar_EventDateTime();
                    $end->setDateTime($endTime->format('c'));
                    $event->setEnd($end);
                }
            }

            $this->service->events->update($calendarId, $eventId, $event);
            return true;
        } catch (\Exception $e) {
            \Log::error('Google Calendar event update failed: ' . $e->getMessage());
            return false;
        }
    }

    public function deleteEvent($eventId, $userId, $workspaceId = null)
    {
        if (!$this->isEnabled($userId, $workspaceId) || !$eventId) {
            return false;
        }

        try {
            $this->setupClient($userId, $workspaceId);
            if (!$this->service) {
                throw new \Exception('Google Calendar service not initialized');
            }

            $query = Setting::where('user_id', $userId)
                ->where('key', 'googleCalendarId');

            if ($workspaceId) {
                $query->where('workspace_id', $workspaceId);
            }

            $calendarId = $query->value('value') ?: 'primary';

            $this->service->events->delete($calendarId, $eventId);
            return true;
        } catch (\Exception $e) {
            \Log::error('Google Calendar event deletion failed: ' . $e->getMessage());
            return false;
        }
    }

    public function getEvents($userId, $maxResults = 100, $workspaceId = null)
    {
        if (!$this->isEnabled($userId, $workspaceId)) {
            return [];
        }

        try {
            $this->setupClient($userId, $workspaceId);
            if (!$this->service) {
                throw new \Exception('Google Calendar service not initialized');
            }

            $query = Setting::where('user_id', $userId)
                ->where('key', 'googleCalendarId');

            if ($workspaceId) {
                $query->where('workspace_id', $workspaceId);
            }

            $calendarId = $query->value('value') ?: 'primary';

            $optParams = [
                'maxResults' => $maxResults,
                'orderBy' => 'startTime',
                'singleEvents' => true,
                'timeMin' => date('c', strtotime('-1 month')),
            ];

            $results = $this->service->events->listEvents($calendarId, $optParams);
            $events = $results->getItems();

            return array_map(function ($event) {
                $start = $event->getStart()->getDateTime() ?: $event->getStart()->getDate();
                $end = $event->getEnd()->getDateTime() ?: $event->getEnd()->getDate();

                return [
                    'id' => 'google_' . $event->getId(),
                    'title' => $event->getSummary() ?: 'Untitled Event',
                    'description' => $event->getDescription() ?: '',
                    'date' => substr($start, 0, 10),
                    'time' => strpos($start, 'T') !== false ? substr($start, 11, 8) : null,
                    'end_time' => strpos($end, 'T') !== false ? substr($end, 11, 8) : null,
                    'type' => 'google_calendar',
                    'color' => '#4285f4',
                    'source' => 'google',
                ];
            }, $events);
        } catch (\Exception $e) {
            \Log::error('Google Calendar events fetch failed: ' . $e->getMessage());
            return [];
        }
    }

    public function isAuthorized($userId, $workspaceId = null)
    {
        $query = Setting::where('user_id', $userId)
            ->where('key', 'googleCalendarJsonPath');

        if ($workspaceId) {
            $query->where('workspace_id', $workspaceId);
        }

        $jsonPath = $query->value('value');

        if (!$jsonPath) {
            return false;
        }

        $paths = [
            $jsonPath,
            storage_path($jsonPath),
            storage_path('app/' . $jsonPath),
            storage_path('app/public/' . $jsonPath),
        ];

        foreach ($paths as $path) {
            if (file_exists($path)) {
                return true;
            }
        }

        return false;
    }

    public function createMeetingEvent($meeting, $userId, $workspaceId = null)
    {
        if (!$this->isEnabled($userId, $workspaceId)) {
            return null;
        }
        
        try {
            $this->setupClient($userId, $workspaceId);
            if (!$this->service) {
                throw new \Exception('Google Calendar service not initialized');
            }
            
            $description = $meeting->description ?? '';
            if ($meeting->join_url) {
                $description .= "\n\nJoin Zoom Meeting: " . $meeting->join_url;
            }
            if ($meeting->password) {
                $description .= "\nMeeting Password: " . $meeting->password;
            }
            
            $event = new Google_Service_Calendar_Event([
                'summary' => $meeting->title,
                'description' => $description,
                'extendedProperties' => [
                    'private' => [
                        'app_type' => 'zoom_meeting',
                        'app_id' => $meeting->id,
                        'app_user_id' => $userId
                    ]
                ]
            ]);

            if ($meeting->start_time) {
                $startTime = $meeting->start_time->copy();
                $endTime = $meeting->end_time ?? $startTime->copy()->addMinutes($meeting->duration);

                $start = new Google_Service_Calendar_EventDateTime();
                $start->setDateTime($startTime->format('c'));
                $event->setStart($start);

                $end = new Google_Service_Calendar_EventDateTime();
                $end->setDateTime($endTime->format('c'));
                $event->setEnd($end);
            } else {
                return null;
            }

            $query = Setting::where('user_id', $userId)
                ->where('key', 'googleCalendarId');

            if ($workspaceId) {
                $query->where('workspace_id', $workspaceId);
            }

            $calendarId = $query->value('value') ?: 'primary';
            
            try {
                $calendarEvent = $this->service->events->insert($calendarId, $event);
                return $calendarEvent->getId();
            } catch (\Exception $apiError) {
                \Log::warning('Google Calendar API error with custom calendar, trying primary', [
                    'error' => $apiError->getMessage(),
                    'calendar_id' => $calendarId
                ]);
                
                // Try with primary calendar as fallback
                try {
                    $calendarEvent = $this->service->events->insert('primary', $event);
                    return $calendarEvent->getId();
                } catch (\Exception $primaryError) {
                    throw new \Exception('Failed to create event in both custom and primary calendars: ' . $primaryError->getMessage());
                }
            }
        } catch (\Exception $e) {
            \Log::error('Google Calendar meeting event creation failed: ' . $e->getMessage());
            return null;
        }
    }

    public function updateMeetingEvent($eventId, $meeting, $userId, $workspaceId = null)
    {
        if (!$this->isEnabled($userId, $workspaceId) || !$eventId) {
            return false;
        }

        try {
            $this->setupClient($userId, $workspaceId);
            if (!$this->service) {
                throw new \Exception('Google Calendar service not initialized');
            }

            $query = Setting::where('user_id', $userId)
                ->where('key', 'googleCalendarId');

            if ($workspaceId) {
                $query->where('workspace_id', $workspaceId);
            }

            $calendarId = $query->value('value') ?: 'primary';

            $event = $this->service->events->get($calendarId, $eventId);

            $event->setSummary($meeting->title);
            
            $description = $meeting->description ?? '';
            if ($meeting->join_url) {
                $description .= "\n\nJoin Zoom Meeting: " . $meeting->join_url;
            }
            if ($meeting->password) {
                $description .= "\nMeeting Password: " . $meeting->password;
            }
            $event->setDescription($description);

            if ($meeting->start_time) {
                $startTime = $meeting->start_time->copy();
                $endTime = $meeting->end_time ?? $startTime->copy()->addMinutes($meeting->duration);

                $start = new Google_Service_Calendar_EventDateTime();
                $start->setDateTime($startTime->format('c'));
                $event->setStart($start);

                $end = new Google_Service_Calendar_EventDateTime();
                $end->setDateTime($endTime->format('c'));
                $event->setEnd($end);
            }

            $this->service->events->update($calendarId, $eventId, $event);
            return true;
        } catch (\Exception $e) {
            \Log::error('Google Calendar meeting event update failed: ' . $e->getMessage());
            return false;
        }
    }

    public function createGoogleMeetingEvent($meeting, $userId, $workspaceId = null)
    {
        if (!$this->isEnabled($userId, $workspaceId)) {
            return null;
        }
        
        try {
            $this->setupClient($userId, $workspaceId);
            if (!$this->service) {
                throw new \Exception('Google Calendar service not initialized');
            }
            
            $description = $meeting->description ?? '';
            if ($meeting->meet_url) {
                $description .= "\n\nJoin Google Meet: " . $meeting->meet_url;
            }
            
            $event = new Google_Service_Calendar_Event([
                'summary' => $meeting->title,
                'description' => $description,
                'extendedProperties' => [
                    'private' => [
                        'app_type' => 'google_meeting',
                        'app_id' => $meeting->id,
                        'app_user_id' => $userId
                    ]
                ]
            ]);

            if ($meeting->start_time) {
                $startTime = $meeting->start_time->copy();
                $endTime = $meeting->end_time ?? $startTime->copy()->addMinutes($meeting->duration);

                $start = new Google_Service_Calendar_EventDateTime();
                $start->setDateTime($startTime->format('c'));
                $start->setTimeZone($startTime->getTimezone()->getName());
                $event->setStart($start);

                $end = new Google_Service_Calendar_EventDateTime();
                $end->setDateTime($endTime->format('c'));
                $end->setTimeZone($endTime->getTimezone()->getName());
                $event->setEnd($end);
            } else {
                return null;
            }

            $query = Setting::where('user_id', $userId)
                ->where('key', 'googleCalendarId');

            if ($workspaceId) {
                $query->where('workspace_id', $workspaceId);
            }

            $calendarId = $query->value('value') ?: 'primary';
            
            try {
                $calendarEvent = $this->service->events->insert($calendarId, $event);
                return $calendarEvent->getId();
            } catch (\Exception $apiError) {
                \Log::warning('Google Calendar API error with custom calendar, trying primary', [
                    'error' => $apiError->getMessage(),
                    'calendar_id' => $calendarId
                ]);
                
                try {
                    $calendarEvent = $this->service->events->insert('primary', $event);
                    return $calendarEvent->getId();
                } catch (\Exception $primaryError) {
                    throw new \Exception('Failed to create event in both custom and primary calendars: ' . $primaryError->getMessage());
                }
            }
        } catch (\Exception $e) {
            \Log::error('Google Calendar google meeting event creation failed: ' . $e->getMessage());
            return null;
        }
    }

    public function updateGoogleMeetingEvent($eventId, $meeting, $userId, $workspaceId = null)
    {
        if (!$this->isEnabled($userId, $workspaceId) || !$eventId) {
            return false;
        }

        try {
            $this->setupClient($userId, $workspaceId);
            if (!$this->service) {
                throw new \Exception('Google Calendar service not initialized');
            }

            $query = Setting::where('user_id', $userId)
                ->where('key', 'googleCalendarId');

            if ($workspaceId) {
                $query->where('workspace_id', $workspaceId);
            }

            $calendarId = $query->value('value') ?: 'primary';

            $event = $this->service->events->get($calendarId, $eventId);

            $event->setSummary($meeting->title);
            
            $description = $meeting->description ?? '';
            if ($meeting->meet_url) {
                $description .= "\n\nJoin Google Meet: " . $meeting->meet_url;
            }
            $event->setDescription($description);

            if ($meeting->start_time) {
                $startTime = $meeting->start_time->copy();
                $endTime = $meeting->end_time ?? $startTime->copy()->addMinutes($meeting->duration);

                $start = new Google_Service_Calendar_EventDateTime();
                $start->setDateTime($startTime->format('c'));
                $start->setTimeZone($startTime->getTimezone()->getName());
                $event->setStart($start);

                $end = new Google_Service_Calendar_EventDateTime();
                $end->setDateTime($endTime->format('c'));
                $end->setTimeZone($endTime->getTimezone()->getName());
                $event->setEnd($end);
            }

            $this->service->events->update($calendarId, $eventId, $event);
            return true;
        } catch (\Exception $e) {
            \Log::error('Google Calendar google meeting event update failed: ' . $e->getMessage());
            return false;
        }
    }
}

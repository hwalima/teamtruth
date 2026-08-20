import React, { useState, useEffect } from 'react';
import { router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Clock } from 'lucide-react';

interface TimerState {
    active: boolean;
    elapsed_seconds: number;
    is_paused: boolean;
}

export default function NavigationTimer() {
    const [timerState, setTimerState] = useState<TimerState>({
        active: false,
        elapsed_seconds: 0,
        is_paused: false
    });
    const [displayTime, setDisplayTime] = useState('00:00:00');

    useEffect(() => {
        fetchTimerStatus();
        const statusInterval = setInterval(fetchTimerStatus, 2000);

        // Listen for all timer events
        const handleTimerEvent = () => {
            fetchTimerStatus();
        };
        window.addEventListener('timerStarted', handleTimerEvent);
        window.addEventListener('timerStopped', handleTimerEvent);
        window.addEventListener('timerPaused', handleTimerEvent);
        window.addEventListener('timerResumed', handleTimerEvent);
        window.addEventListener('workspaceChanged', handleTimerEvent);

        return () => {
            clearInterval(statusInterval);
            window.removeEventListener('timerStarted', handleTimerEvent);
            window.removeEventListener('timerStopped', handleTimerEvent);
            window.removeEventListener('timerPaused', handleTimerEvent);
            window.removeEventListener('timerResumed', handleTimerEvent);
            window.removeEventListener('workspaceChanged', handleTimerEvent);
        };
    }, []);

    useEffect(() => {
        let timerInterval: NodeJS.Timeout | null = null;
        
        if (timerState.active && !timerState.is_paused) {
            timerInterval = setInterval(() => {
                setTimerState(prevState => ({
                    ...prevState,
                    elapsed_seconds: prevState.elapsed_seconds + 1
                }));
            }, 1000);
        }

        return () => {
            if (timerInterval) clearInterval(timerInterval);
        };
    }, [timerState.active, timerState.is_paused]);

    useEffect(() => {
        const totalSeconds = Math.floor(timerState.elapsed_seconds);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        setDisplayTime(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }, [timerState.elapsed_seconds]);

    const fetchTimerStatus = async () => {
        try {
            if (typeof route === 'undefined') {
                console.warn('Route helper not available');
                return;
            }
            const response = await fetch(route('timer.status'));
            if (response.ok) {
                const data = await response.json();
                if (data.active) {
                    setTimerState(data);
                } else {
                    setTimerState({
                        active: false,
                        elapsed_seconds: 0,
                        is_paused: false
                    });
                }
            }
        } catch (error) {
            console.error('Failed to fetch timer status:', error);
        }
    };

    const navigateToTimer = () => {
        try {
            if (typeof route === 'undefined') {
                window.location.href = route('timesheets.index');
                return;
            }
            router.visit(route('timesheets.index'));
        } catch (error) {
            console.error('Navigation failed:', error);
            window.location.href = route('timesheets.index');
        }
    };

    const buttonClass = timerState.active 
        ? (timerState.is_paused 
            ? 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100' 
            : 'bg-green-50 border-green-200 hover:bg-green-100')
        : 'bg-blue-50 border-blue-200 hover:bg-blue-100';

    const iconClass = timerState.active 
        ? (timerState.is_paused ? 'text-yellow-600' : 'text-green-600')
        : 'text-blue-600';

    const textClass = timerState.active 
        ? (timerState.is_paused ? 'text-yellow-800' : 'text-green-800')
        : 'text-blue-800';

    return (
        <Button 
            variant="outline" 
            size="sm" 
            className={`gap-2 ${buttonClass}`}
            onClick={navigateToTimer}
        >
            <Clock className={`h-4 w-4 ${iconClass}`} />
            <span className={`font-mono text-xs ${textClass}`}>
                {displayTime}
            </span>
        </Button>
    );
}
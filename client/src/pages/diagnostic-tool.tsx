import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle, XCircle, Info } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { useQuery } from '@tanstack/react-query';

export default function DiagnosticTool() {
  const { sessionId, sessionData, retryFailedResults } = useSession();
  const [diagnosticResults, setDiagnosticResults] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);

  // Get failed results from localStorage
  const failedResults = JSON.parse(localStorage.getItem('failedResults') || '[]');
  
  // Get current session details
  const { data: fullSessionData } = useQuery({
    queryKey: [`/api/sessions/${sessionId}/full`],
    enabled: !!sessionId,
  });

  const runDiagnostic = async () => {
    setIsRunning(true);
    
    try {
      const diagnostic = {
        timestamp: new Date().toISOString(),
        sessionId,
        sessionData,
        failedResults,
        localStorage: {
          currentSessionId: localStorage.getItem('currentSessionId'),
          currentLocation: localStorage.getItem('currentLocation'),
          lastSelectedFrequency: localStorage.getItem('lastSelectedFrequency'),
        },
        networkStatus: navigator.onLine,
        userAgent: navigator.userAgent,
        performance: {
          memoryUsage: (performance as any).memory ? {
            usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
            totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
          } : 'Not available',
        },
        databaseConsistency: fullSessionData ? {
          sessionResultsCount: fullSessionData.results?.length || 0,
          expectedCount: 'Unknown',
          lastResultId: fullSessionData.results?.length > 0 ? 
            Math.max(...fullSessionData.results.map((r: any) => r.id)) : 'None',
        } : 'Session not loaded',
      };

      setDiagnosticResults(diagnostic);
      
      // Also log to console for debugging
      console.log('DIAGNOSTIC REPORT:', diagnostic);
      
    } catch (error) {
      console.error('Diagnostic error:', error);
      setDiagnosticResults({ error: String(error) });
    } finally {
      setIsRunning(false);
    }
  };

  const handleRetryFailed = async () => {
    if (retryFailedResults) {
      await retryFailedResults();
    }
  };

  return (
    <div className="mobile-container p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">Data Loss Diagnostic Tool</h1>
          <p className="text-gray-600">
            This tool helps identify issues with test result data loss and provides recovery options.
          </p>
        </div>

        <div className="grid gap-4 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                Current Session Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span>Session ID:</span>
                  <Badge variant={sessionId ? "default" : "secondary"}>
                    {sessionId || 'None'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Total Results:</span>
                  <Badge variant="outline">
                    {sessionData?.results?.length || 0}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Network Status:</span>
                  <Badge variant={navigator.onLine ? "default" : "destructive"}>
                    {navigator.onLine ? 'Online' : 'Offline'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Failed Results Recovery
              </CardTitle>
              <CardDescription>
                Results that failed to save are stored locally for recovery
              </CardDescription>
            </CardHeader>
            <CardContent>
              {failedResults.length > 0 ? (
                <div className="space-y-3">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Found {failedResults.length} failed result(s) that can be retried
                    </AlertDescription>
                  </Alert>
                  
                  <div className="space-y-2">
                    {failedResults.map((failed: any, index: number) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-md">
                        <div className="text-sm font-medium">
                          Asset #{failed.data.assetNumber} - {failed.data.itemName}
                        </div>
                        <div className="text-xs text-gray-600">
                          Failed at: {new Date(failed.timestamp).toLocaleString()}
                        </div>
                        <div className="text-xs text-red-600 mt-1">
                          Error: {failed.error}
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button onClick={handleRetryFailed} className="w-full">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Retry Failed Results
                  </Button>
                </div>
              ) : (
                <div className="text-center py-4 text-gray-600">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-600" />
                  No failed results found
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mb-6">
          <Button 
            onClick={runDiagnostic} 
            disabled={isRunning}
            size="lg"
            className="w-full"
          >
            {isRunning ? 'Running Diagnostic...' : 'Run Full Diagnostic'}
          </Button>
        </div>

        {diagnosticResults && (
          <Card>
            <CardHeader>
              <CardTitle>Diagnostic Results</CardTitle>
              <CardDescription>
                Generated at {new Date(diagnosticResults.timestamp).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Session Information</h4>
                  <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                    {JSON.stringify(diagnosticResults.sessionData, null, 2)}
                  </pre>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Database Consistency</h4>
                  <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                    {JSON.stringify(diagnosticResults.databaseConsistency, null, 2)}
                  </pre>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">System Information</h4>
                  <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                    {JSON.stringify({
                      networkStatus: diagnosticResults.networkStatus,
                      localStorage: diagnosticResults.localStorage,
                      performance: diagnosticResults.performance,
                    }, null, 2)}
                  </pre>
                </div>

                <div className="mt-4 p-3 bg-blue-50 rounded">
                  <h4 className="font-semibold text-blue-800 mb-2">Instructions</h4>
                  <p className="text-sm text-blue-700">
                    Please copy this diagnostic information and send it to support if you continue 
                    experiencing data loss issues. This will help identify the root cause.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
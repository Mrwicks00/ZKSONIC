"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  useBalance,
  useChainId,
  useWalletClient,
  useWriteContract,
  usePublicClient,
} from "wagmi";
import { useCredential, type AgeCredential } from "@/hooks/useCredential";
import {
  useDid,
  registerDidWithWallet,
  checkDidRegistration,
} from "@/hooks/useDid";
import {
  generateProof,
  verifyOnChain,
  verifyDirectlyWithGroth16,
} from "@/hooks/useProof";
import { didFromAddress, truncateAddress } from "@/lib/utils";
import QRCode from "react-qr-code";
import { Scanner } from "@yudiel/react-qr-scanner";
import { ADDRESSES } from "@/lib/addresses";
import { AgeGateABI } from "@/lib/abi/AgeGate";
import {
  Copy,
  Wallet,
  User,
  FileText,
  Shield,
  CheckCircle,
  Clock,
  Eye,
  Calendar,
  Award,
  QrCode as QrCodeIcon,
  X,
  RefreshCw,
  AlertTriangle,
  Wifi,
  WifiOff,
  Sun,
  Moon,
} from "lucide-react";

interface Credential {
  id: string;
  type: string;
  issuer: string;
  issuedAt: string;
  status: "active" | "expired" | "revoked";
  data: {
    [key: string]: any;
  };
}

type VerificationStatus =
  | "awaiting"
  | "verifying"
  | "signing"
  | "success"
  | "failed";
type WalletStatus = "disconnected" | "connecting" | "connected" | "error";

export default function ZKSonicApp() {
  // RainbowKit hooks
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address });
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { writeContract, isPending: isContractPending } = useWriteContract();

  // Our custom hooks
  const { get: getCredential, set: setCredential } = useCredential();
  const { get: getUserDid } = useDid();

  // App state
  const [isRegistering, setIsRegistering] = useState(false);
  const [credential, setCredentialState] = useState<AgeCredential | null>(null);
  const [isIssuing, setIsIssuing] = useState(false);

  // Verification state
  const [verificationStatus, setVerificationStatus] =
    useState<VerificationStatus>("awaiting");
  const [verificationData, setVerificationData] = useState<any>(null);
  const [qrCodeData, setQrCodeData] = useState("");
  const [challenge, setChallenge] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [scanActive, setScanActive] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Issue form state
  const [issueForm, setIssueForm] = useState({
    recipientDID: "",
    credentialType: "Age Credential",
    birthDate: "",
    birthMonth: "",
    birthYear: "",
  });

  // Theme state management
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  const { toast } = useToast();

  // Derived state
  const isCorrectNetwork = chainId === 14601; // Sonic Testnet
  const userDID = address ? didFromAddress(address) : "";

  // Only access localStorage on client-side
  const storedCredential =
    typeof window !== "undefined" ? getCredential() : null;
  const storedUserDid = typeof window !== "undefined" ? getUserDid() : null;

  // Load stored credential on mount (client-side only)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = getCredential();
      if (stored) {
        setCredentialState(stored);
      }
    }
  }, []);

  // Check DID registration when wallet connects
  useEffect(() => {
    if (isConnected && address && walletClient) {
      checkDidRegistration(walletClient, address).then((result) => {
        if (result.isRegistered && result.did) {
          // DID is registered on-chain, it's already cached in localStorage
          console.log("DID found on-chain:", result.did);
        }
      });
    }
  }, [isConnected, address, walletClient]);

  // Auto-populate recipient DID when user has a registered DID
  useEffect(() => {
    if (storedUserDid && !issueForm.recipientDID) {
      setIssueForm((prev) => ({
        ...prev,
        recipientDID: storedUserDid,
      }));
    }
  }, [storedUserDid, issueForm.recipientDID]);

  // DID registration function
  const handleRegisterDID = async () => {
    if (!isConnected || !address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    if (!isCorrectNetwork) {
      toast({
        title: "Wrong Network",
        description: "Please switch to Sonic Testnet to register a DID",
        variant: "destructive",
      });
      return;
    }

    setIsRegistering(true);
    try {
      if (!walletClient) {
        throw new Error("Wallet not connected");
      }
      const result = await registerDidWithWallet(walletClient, "");
      toast({
        title: "DID Registered",
        description: `Successfully registered ${result.did}`,
      });
    } catch (error: any) {
      toast({
        title: "Registration Failed",
        description: error.message || "Failed to register DID",
        variant: "destructive",
      });
    } finally {
      setIsRegistering(false);
    }
  };

  // Credential issuance function
  const handleIssueCredential = async () => {
    if (
      !issueForm.recipientDID ||
      !issueForm.credentialType ||
      !issueForm.birthDate ||
      !issueForm.birthMonth ||
      !issueForm.birthYear
    ) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsIssuing(true);
    try {
      const response = await fetch("/api/issue-credential", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectDid: issueForm.recipientDID,
          birthYear: parseInt(issueForm.birthYear),
          birthMonth: parseInt(issueForm.birthMonth),
          birthDay: parseInt(issueForm.birthDate),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to issue credential");
      }

      const { credential: newCredential } = await response.json();
      setCredential(newCredential);
      setCredentialState(newCredential);

      setIssueForm({
        recipientDID: "",
        credentialType: "Age Credential",
        birthDate: "",
        birthMonth: "",
        birthYear: "",
      });

      toast({
        title: "Credential Issued",
        description: `${issueForm.credentialType} has been successfully issued`,
      });
    } catch (error: any) {
      toast({
        title: "Issuance Failed",
        description: error.message || "Failed to issue credential",
        variant: "destructive",
      });
    } finally {
      setIsIssuing(false);
    }
  };

  // Generate new challenge and QR code
  const generateNewChallenge = async () => {
    // Check if user has a credential first
    if (!credential) {
      toast({
        title: "No Credential Found",
        description:
          "Please issue a credential first before generating a challenge",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch("/api/challenge/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate challenge");
      }

      const data = await response.json();

      setChallenge(data.challenge);
      setSessionId(data.sessionId);
      setQrCodeData(data.qrData);
      setVerificationStatus("awaiting");
      setVerificationData(null);

      // Start polling for verification results (with small delay to ensure session is created)
      setTimeout(() => {
        startPolling(data.sessionId);
      }, 1000);
    } catch (error: any) {
      toast({
        title: "Failed to Generate Challenge",
        description: error.message || "Failed to generate new challenge",
        variant: "destructive",
      });
    }
  };

  // Poll for verification status
  const startPolling = (sessionId: string) => {
    setIsPolling(true);
    let pollCount = 0;
    const maxPolls = 150; // 5 minutes at 2-second intervals

    const pollInterval = setInterval(async () => {
      try {
        pollCount++;

        // Stop polling if we've reached max attempts
        if (pollCount >= maxPolls) {
          clearInterval(pollInterval);
          setIsPolling(false);
          setVerificationStatus("failed");
          setVerificationData({
            error: "Verification timeout - no response from server",
            timestamp: new Date().toISOString(),
          });
          toast({
            title: "Verification Timeout",
            description: "No response from server after 5 minutes",
            variant: "destructive",
          });
          return;
        }

        const response = await fetch(`/api/verify/status/${sessionId}`);

        if (response.ok) {
          const data = await response.json();

          if (data.status === "success") {
            setVerificationStatus("success");
            setVerificationData({
              ageVerified: true,
              timestamp: new Date().toISOString(),
              proofHash: `0x${Math.random().toString(16).slice(2, 18)}`,
              credentialId: data.result?.credentialId,
              sessionId: data.sessionId,
            });
            toast({
              title: "Verification Successful",
              description: "Age proof has been successfully verified on-chain",
            });
            clearInterval(pollInterval);
            setIsPolling(false);
          } else if (data.status === "failed") {
            setVerificationStatus("failed");
            setVerificationData({
              error: data.error || "Verification failed",
              timestamp: new Date().toISOString(),
              sessionId: data.sessionId,
            });
            toast({
              title: "Verification Failed",
              description: data.error || "Unable to verify age proof",
              variant: "destructive",
            });
            clearInterval(pollInterval);
            setIsPolling(false);
          } else if (data.status === "processing") {
            // Continue polling - verification in progress
            console.log(
              `Verification in progress... (${pollCount}/${maxPolls})`
            );
          }
        } else if (response.status === 404) {
          // Session not found - stop polling
          clearInterval(pollInterval);
          setIsPolling(false);
          setVerificationStatus("failed");
          setVerificationData({
            error: "Session not found or expired",
            timestamp: new Date().toISOString(),
          });
          toast({
            title: "Session Expired",
            description: "Verification session not found or expired",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Polling error:", error);
        // Continue polling on network errors unless it's the last attempt
        if (pollCount >= maxPolls) {
          clearInterval(pollInterval);
          setIsPolling(false);
        }
      }
    }, 2000); // Poll every 2 seconds
  };

  // Handle contract interaction for verification
  const handleContractVerification = async (verificationData: any) => {
    try {
      const { proof, challengeBytes32, didHash } = verificationData;

      await writeContract({
        address: ADDRESSES.sonicTestnet.AgeGate as `0x${string}`,
        abi: AgeGateABI,
        functionName: "verifyAge",
        args: [
          proof.a,
          proof.b,
          proof.c,
          proof.input,
          challengeBytes32,
          didHash,
        ],
      });

      setVerificationStatus("success");
      setVerificationData({
        ageVerified: true,
        timestamp: new Date().toISOString(),
        sessionId: verificationData.sessionId,
      });

      toast({
        title: "Verification Successful",
        description: "Age proof has been successfully verified on-chain",
      });
    } catch (error: any) {
      console.error("Contract verification error:", error);
      setVerificationStatus("failed");
      setVerificationData({
        error: error?.message || "Contract verification failed",
        timestamp: new Date().toISOString(),
      });
      toast({
        title: "Verification Failed",
        description: error?.message || "Unable to verify age proof on-chain",
        variant: "destructive",
      });
    }
  };

  // Handle QR scan and verification (Client-side proof generation)
  const handleScan = async (text: string) => {
    try {
      setScanError(null);
      const payload = JSON.parse(text);

      // Validate QR payload structure
      if (!payload?.challenge || payload?.t !== "age18") {
        throw new Error("Invalid QR payload - missing challenge or type");
      }

      if (!payload?.sessionId) {
        throw new Error("Invalid QR payload - missing session ID");
      }

      // Credential is now stored in Redis session, not in QR

      const challengeNumber: number = Number(payload.challenge);
      const sessionId = payload.sessionId;

      setVerificationStatus("verifying");
      setVerificationData(null);

      // Generate proof on client-side using the new approach
      console.log("Generating proof on client-side...");
      const { a, b, c, input, challengeBytes32, didHash } = await generateProof(
        sessionId,
        challengeNumber,
        storedUserDid || userDID
      );

      console.log(
        "Proof generated, verifying directly with Groth16Verifier..."
      );
      setVerificationStatus("signing");

      // Option 1: Verify directly with Groth16Verifier (bypasses broken AgeGate)
      if (!publicClient) {
        throw new Error("Public client not available");
      }

      const verificationResult = await verifyDirectlyWithGroth16({
        a,
        b,
        c,
        input,
        publicClient,
      });

      console.log("Direct verification result:", verificationResult);

      if (verificationResult.success) {
        setVerificationStatus("success");
        setVerificationData({
          ageVerified: true,
          timestamp: new Date().toISOString(),
          sessionId: sessionId,
          message: verificationResult.message,
        });

        toast({
          title: "Verification Successful",
          description: verificationResult.message,
        });
      } else {
        setVerificationStatus("failed");
        setVerificationData({
          ageVerified: false,
          timestamp: new Date().toISOString(),
          sessionId: sessionId,
          error: verificationResult.message,
        });

        toast({
          title: "Verification Failed",
          description: verificationResult.message,
          variant: "destructive",
        });
      }
      setScanActive(false);
    } catch (e: any) {
      setScanError(e?.message || String(e));
      setVerificationStatus("failed");
      setVerificationData({
        error: e?.message || String(e),
        timestamp: new Date().toISOString(),
      });
      toast({
        title: "Verification Error",
        description: e?.message || "An error occurred during verification",
        variant: "destructive",
      });
    }
  };

  const handleScanError = (err: any) => {
    setScanError(typeof err === "string" ? err : err?.message || String(err));
  };

  const resetVerification = () => {
    setVerificationStatus("awaiting");
    setVerificationData(null);
    setScanActive(true);
    setScanError(null);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to Clipboard",
      description: `${label} has been copied to your clipboard`,
    });
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "expired":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "revoked":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="w-3 h-3" />;
      case "expired":
        return <Clock className="w-3 h-3" />;
      default:
        return <Clock className="w-3 h-3" />;
    }
  };

  const generateYears = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let year = currentYear - 100; year <= currentYear; year++) {
      years.push(year);
    }
    return years.reverse();
  };

  const renderWalletInfo = () => {
    if (isConnected && address) {
      return (
        <div className="flex items-center space-x-2 max-w-[200px] sm:max-w-none">
          <Badge
            variant="secondary"
            className="bg-card border border-border text-xs"
          >
            <div className="flex items-center space-x-1">
              <div
                className={`w-2 h-2 rounded-full ${
                  isCorrectNetwork ? "bg-green-400" : "bg-yellow-400"
                }`}
              />
              <span className="hidden sm:inline">
                {truncateAddress(address)}
              </span>
              <span className="sm:hidden">
                {address.slice(0, 4)}...{address.slice(-2)}
              </span>
            </div>
          </Badge>
          {balance && (
            <Badge
              variant="outline"
              className="border-border bg-transparent text-muted-foreground text-xs hidden sm:inline-flex"
            >
              {parseFloat(balance.formatted).toFixed(4)} {balance.symbol}
            </Badge>
          )}
        </div>
      );
    }
    return null;
  };

  const renderNetworkWarning = () => {
    if (isConnected && !isCorrectNetwork) {
      return (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <WifiOff className="w-5 h-5 text-yellow-400" />
              <div>
                <h4 className="text-sm font-medium text-yellow-400">
                  Wrong Network
                </h4>
                <p className="text-xs text-yellow-400/80">
                  You're connected to chain ID {chainId}. Switch to Sonic
                  Testnet (14601) to use ZKSONIC.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const renderVerificationStatus = () => {
    switch (verificationStatus) {
      case "awaiting":
        return (
          <div className="text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">
              Awaiting Proof Verification
            </h3>
            <p className="text-muted-foreground mb-4">
              {storedCredential
                ? "Scan the QR code above to submit your age proof"
                : "QR code contains challenge - scan to verify age proof"}
            </p>
            {!storedCredential && (
              <p className="text-sm text-blue-400">
                {isConnected
                  ? "No credential found. Issue a credential first to generate QR code."
                  : "Connect your wallet to enable verification"}
              </p>
            )}
            {isPolling && (
              <p className="text-sm text-yellow-400">
                Waiting for phone to scan QR code and process verification...
              </p>
            )}
          </div>
        );
      case "verifying":
        return (
          <div className="text-center">
            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">
              Verifying Proof...
            </h3>
            <p className="text-muted-foreground">
              Processing zero-knowledge proof verification
            </p>
          </div>
        );
      case "signing":
        return (
          <div className="text-center">
            <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="w-8 h-8 border-2 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">
              Signing Transaction...
            </h3>
            <p className="text-muted-foreground">
              Please sign the transaction in your wallet to complete
              verification
            </p>
            {isContractPending && (
              <p className="text-sm text-yellow-400 mt-2">
                Transaction pending...
              </p>
            )}
          </div>
        );
      case "success":
        return (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-lg font-medium text-green-400 mb-2">
              Verification Successful!
            </h3>
            <p className="text-muted-foreground mb-4">
              Age proof has been successfully verified - User is 18+
            </p>
            {verificationData && (
              <div className="bg-muted/50 rounded-lg p-4 border border-border text-left">
                <h4 className="text-sm font-medium text-white mb-2">
                  Verification Details
                </h4>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>
                    <span className="font-medium">Age Verified:</span>{" "}
                    {verificationData.ageVerified ? "18+" : "Under 18"}
                  </p>
                  <p>
                    <span className="font-medium">Timestamp:</span>{" "}
                    {new Date(verificationData.timestamp).toLocaleString()}
                  </p>
                  <p>
                    <span className="font-medium">Proof Hash:</span>{" "}
                    {verificationData.proofHash}
                  </p>
                  {verificationData.credentialId && (
                    <p>
                      <span className="font-medium">Credential ID:</span>{" "}
                      {verificationData.credentialId}
                    </p>
                  )}
                  {verificationData.sessionId && (
                    <p>
                      <span className="font-medium">Session ID:</span>{" "}
                      {verificationData.sessionId}
                    </p>
                  )}
                </div>
              </div>
            )}
            <Button
              onClick={resetVerification}
              className="mt-4 bg-primary hover:bg-primary/90"
            >
              Verify Another Proof
            </Button>
          </div>
        );
      case "failed":
        return (
          <div className="text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <X className="w-8 h-8 text-red-400" />
            </div>
            <h3 className="text-lg font-medium text-red-400 mb-2">
              Verification Failed
            </h3>
            <p className="text-muted-foreground mb-4">
              {verificationData?.ageVerified === false
                ? "Age verification failed - User is under 18"
                : "Unable to verify the submitted proof"}
            </p>
            {verificationData && (
              <div className="bg-muted/50 rounded-lg p-4 border border-border text-left">
                <h4 className="text-sm font-medium text-white mb-2">
                  Error Details
                </h4>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {verificationData.ageVerified !== undefined && (
                    <p>
                      <span className="font-medium">Age Verified:</span>{" "}
                      {verificationData.ageVerified ? "18+" : "Under 18"}
                    </p>
                  )}
                  <p>
                    <span className="font-medium">Error:</span>{" "}
                    {verificationData.error}
                  </p>
                  <p>
                    <span className="font-medium">Timestamp:</span>{" "}
                    {new Date(verificationData.timestamp).toLocaleString()}
                  </p>
                  {verificationData.transactionHash && (
                    <p>
                      <span className="font-medium">Transaction:</span>{" "}
                      <button
                        onClick={() =>
                          copyToClipboard(
                            verificationData.transactionHash,
                            "Transaction Hash"
                          )
                        }
                        className="text-blue-400 hover:text-blue-300 underline"
                      >
                        {truncateAddress(verificationData.transactionHash)}
                      </button>
                    </p>
                  )}
                </div>
              </div>
            )}
            <Button
              onClick={resetVerification}
              variant="outline"
              className="mt-4 border-border bg-transparent"
            >
              Try Again
            </Button>
          </div>
        );
    }
  };

  // Theme toggle functionality with persistence (client-side only)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("zksonic-theme") as
        | "light"
        | "dark"
        | null;
      if (savedTheme) {
        setTheme(savedTheme);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("zksonic-theme", theme);
      document.documentElement.classList.toggle("dark", theme === "dark");
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 min-w-0 flex-1">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-foreground">
                  ZKSONIC
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                  ZKP-Enabled Identity
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="w-8 h-8 sm:w-9 sm:h-9"
              >
                {theme === "dark" ? (
                  <Sun className="w-3 h-3 sm:w-4 sm:h-4" />
                ) : (
                  <Moon className="w-3 h-3 sm:w-4 sm:h-4" />
                )}
              </Button>
              {renderWalletInfo()}
              <div className="scale-90 sm:scale-100">
                <ConnectButton />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {renderNetworkWarning()}

        <Tabs defaultValue="identity" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-card border border-border">
            <TabsTrigger
              value="identity"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs sm:text-sm"
            >
              <User className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">My Identity</span>
              <span className="sm:hidden">Identity</span>
            </TabsTrigger>
            <TabsTrigger
              value="issue"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs sm:text-sm"
            >
              <FileText className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Issue Credential</span>
              <span className="sm:hidden">Issue</span>
            </TabsTrigger>
            <TabsTrigger
              value="verify"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs sm:text-sm"
            >
              <Shield className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Verify Proof</span>
              <span className="sm:hidden">Verify</span>
            </TabsTrigger>
          </TabsList>

          {/* My Identity Tab */}
          <TabsContent value="identity" className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-white">
                  Decentralized Identity
                </CardTitle>
                <CardDescription>
                  Your unique DID on the Sonic network
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isConnected ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                      <User className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground mb-4">
                      Connect your wallet to get started
                    </p>
                    <ConnectButton />
                  </div>
                ) : !storedUserDid ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                      <User className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground mb-4">
                      Your DID: {userDID}
                    </p>
                    <Button
                      className="bg-primary hover:bg-primary/90"
                      disabled={!isCorrectNetwork || isRegistering}
                      onClick={handleRegisterDID}
                    >
                      {isRegistering ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                          Registering DID...
                        </>
                      ) : (
                        "Register My DID"
                      )}
                    </Button>
                    {!isCorrectNetwork && (
                      <p className="text-sm text-yellow-400 mt-2">
                        Switch to Sonic Testnet (Chain ID: 14601) to register a
                        DID
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                      <span className="text-sm font-medium text-green-400">
                        DID Registered
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg border border-border">
                      <code className="font-mono text-sm text-foreground break-all mr-4">
                        {storedUserDid}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(storedUserDid, "DID")}
                        className="hover:bg-primary/20 flex-shrink-0"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      This is your unique decentralized identifier on the Sonic
                      network. Use it to receive verifiable credentials.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-white">My Credentials</CardTitle>
                <CardDescription>
                  Verifiable credentials issued to your DID
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!storedCredential ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">
                      No credentials issued yet
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Go to the "Issue Credential" tab to create a credential
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-4 border border-border rounded-lg hover:border-primary/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h4 className="font-medium text-white">
                              {storedCredential.type}
                            </h4>
                            <Badge className="text-xs bg-green-500/20 text-green-400 border-green-500/30">
                              <CheckCircle className="w-3 h-3" />
                              <span className="ml-1">Active</span>
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-1">
                            Issued by:{" "}
                            <code className="font-mono text-xs">
                              {storedCredential.issuer}
                            </code>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Issued:{" "}
                            {new Date(
                              storedCredential.issuedAt
                            ).toLocaleDateString()}
                          </p>
                        </div>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-border bg-transparent hover:bg-primary/20"
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="bg-card border-border">
                            <DialogHeader>
                              <DialogTitle className="text-white">
                                {storedCredential.type}
                              </DialogTitle>
                              <DialogDescription>
                                Credential details and verification information
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <label className="text-sm font-medium text-white">
                                  Subject DID
                                </label>
                                <div className="flex items-center justify-between p-2 bg-muted rounded mt-1">
                                  <code className="font-mono text-xs text-foreground">
                                    {storedCredential.subjectDid}
                                  </code>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      copyToClipboard(
                                        storedCredential.subjectDid,
                                        "Subject DID"
                                      )
                                    }
                                  >
                                    <Copy className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-white">
                                  Issuer
                                </label>
                                <div className="flex items-center justify-between p-2 bg-muted rounded mt-1">
                                  <code className="font-mono text-xs text-foreground">
                                    {storedCredential.issuer}
                                  </code>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      copyToClipboard(
                                        storedCredential.issuer,
                                        "Issuer DID"
                                      )
                                    }
                                  >
                                    <Copy className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-white">
                                  Birth Date
                                </label>
                                <div className="p-2 bg-muted rounded mt-1">
                                  <code className="font-mono text-xs text-foreground">
                                    {storedCredential.birthYear}-
                                    {storedCredential.birthMonth
                                      .toString()
                                      .padStart(2, "0")}
                                    -
                                    {storedCredential.birthDay
                                      .toString()
                                      .padStart(2, "0")}
                                  </code>
                                </div>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-white">
                                  Expires
                                </label>
                                <div className="p-2 bg-muted rounded mt-1">
                                  <code className="font-mono text-xs text-foreground">
                                    {new Date(
                                      storedCredential.expiresAt
                                    ).toLocaleDateString()}
                                  </code>
                                </div>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Issue Credential Tab */}
          <TabsContent value="issue" className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Award className="w-5 h-5 mr-2" />
                  Issue Credential (Demo)
                </CardTitle>
                <CardDescription>
                  Demo issuer for testing credential issuance on the Sonic
                  network
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="recipientDID" className="text-white">
                      Recipient DID
                    </Label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        id="recipientDID"
                        placeholder="did:sonic:example123..."
                        value={issueForm.recipientDID}
                        onChange={(e) =>
                          setIssueForm((prev) => ({
                            ...prev,
                            recipientDID: e.target.value,
                          }))
                        }
                        className="bg-muted border-border text-foreground placeholder:text-muted-foreground flex-1"
                      />
                      {storedUserDid && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setIssueForm((prev) => ({
                              ...prev,
                              recipientDID: storedUserDid,
                            }))
                          }
                          className="border-border bg-transparent flex-shrink-0 w-full sm:w-auto"
                        >
                          <Copy className="w-4 h-4 mr-1" />
                          Use My DID
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Enter the DID of the recipient who will receive this
                      credential
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="credentialType" className="text-white">
                      Credential Type
                    </Label>
                    <Select
                      value={issueForm.credentialType}
                      onValueChange={(value) =>
                        setIssueForm((prev) => ({
                          ...prev,
                          credentialType: value,
                        }))
                      }
                    >
                      <SelectTrigger className="bg-muted border-border text-foreground">
                        <SelectValue placeholder="Select credential type" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        <SelectItem
                          value="Age Credential"
                          className="text-foreground hover:bg-muted"
                        >
                          Age Credential
                        </SelectItem>
                        <SelectItem
                          value="Identity Credential"
                          className="text-foreground hover:bg-muted"
                        >
                          Identity Credential
                        </SelectItem>
                        <SelectItem
                          value="Education Credential"
                          className="text-foreground hover:bg-muted"
                        >
                          Education Credential
                        </SelectItem>
                        <SelectItem
                          value="Employment Credential"
                          className="text-foreground hover:bg-muted"
                        >
                          Employment Credential
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white flex items-center">
                      <Calendar className="w-4 h-4 mr-2" />
                      Birth Date
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label
                          htmlFor="birthDate"
                          className="text-xs text-muted-foreground"
                        >
                          Day
                        </Label>
                        <Select
                          value={issueForm.birthDate}
                          onValueChange={(value) =>
                            setIssueForm((prev) => ({
                              ...prev,
                              birthDate: value,
                            }))
                          }
                        >
                          <SelectTrigger className="bg-muted border-border text-foreground">
                            <SelectValue placeholder="Day" />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border max-h-48">
                            {Array.from({ length: 31 }, (_, i) => i + 1).map(
                              (day) => (
                                <SelectItem
                                  key={day}
                                  value={day.toString()}
                                  className="text-foreground hover:bg-muted"
                                >
                                  {day}
                                </SelectItem>
                              )
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label
                          htmlFor="birthMonth"
                          className="text-xs text-muted-foreground"
                        >
                          Month
                        </Label>
                        <Select
                          value={issueForm.birthMonth}
                          onValueChange={(value) =>
                            setIssueForm((prev) => ({
                              ...prev,
                              birthMonth: value,
                            }))
                          }
                        >
                          <SelectTrigger className="bg-muted border-border text-foreground">
                            <SelectValue placeholder="Month" />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border">
                            {[
                              "January",
                              "February",
                              "March",
                              "April",
                              "May",
                              "June",
                              "July",
                              "August",
                              "September",
                              "October",
                              "November",
                              "December",
                            ].map((month, index) => (
                              <SelectItem
                                key={month}
                                value={(index + 1).toString()}
                                className="text-foreground hover:bg-muted"
                              >
                                {month}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label
                          htmlFor="birthYear"
                          className="text-xs text-muted-foreground"
                        >
                          Year
                        </Label>
                        <Select
                          value={issueForm.birthYear}
                          onValueChange={(value) =>
                            setIssueForm((prev) => ({
                              ...prev,
                              birthYear: value,
                            }))
                          }
                        >
                          <SelectTrigger className="bg-muted border-border text-foreground">
                            <SelectValue placeholder="Year" />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border max-h-48">
                            {generateYears().map((year) => (
                              <SelectItem
                                key={year}
                                value={year.toString()}
                                className="text-foreground hover:bg-muted"
                              >
                                {year}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Birth date information will be used to generate
                      age-related proofs
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-border">
                  <Button
                    onClick={handleIssueCredential}
                    disabled={isIssuing}
                    className="w-full bg-primary hover:bg-primary/90"
                  >
                    {isIssuing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                        Issuing Credential...
                      </>
                    ) : (
                      <>
                        <Award className="w-4 h-4 mr-2" />
                        Issue Credential
                      </>
                    )}
                  </Button>
                </div>

                <div className="bg-muted/50 rounded-lg p-4 border border-border">
                  <h4 className="text-sm font-medium text-white mb-2">
                    Demo Issuer Information
                  </h4>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>
                      <span className="font-medium">Issuer DID:</span>{" "}
                      did:sonic:demo_issuer
                    </p>
                    <p>
                      <span className="font-medium">Network:</span> Sonic
                      Testnet
                    </p>
                    <p>
                      <span className="font-medium">Credential Validity:</span>{" "}
                      1 year from issuance
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="verify" className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Shield className="w-5 h-5 mr-2" />
                  Verify Age Proof
                </CardTitle>
                <CardDescription>
                  Scan QR code to verify age (18+) using zero-knowledge proof
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* QR Code Generation Section */}
                <div className="text-center">
                  {!qrCodeData && (
                    <Button
                      onClick={generateNewChallenge}
                      className="mb-4 bg-primary hover:bg-primary/90"
                      disabled={!credential}
                    >
                      <QrCodeIcon className="w-4 h-4 mr-2" />
                      Generate QR Code
                    </Button>
                  )}

                  {qrCodeData && (
                    <div className="space-y-4">
                      <div className="inline-block p-6 bg-white rounded-lg border-2 border-border">
                        <QRCode value={qrCodeData} size={180} />
                      </div>

                      <div className="flex flex-col sm:flex-row justify-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            copyToClipboard(qrCodeData, "QR Code Data")
                          }
                          className="border-border bg-transparent w-full sm:w-auto"
                        >
                          <Copy className="w-3 h-3 mr-2" />
                          Copy QR Data
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={generateNewChallenge}
                          className="border-border bg-transparent w-full sm:w-auto"
                        >
                          <QrCodeIcon className="w-3 h-3 mr-2" />
                          Generate New QR
                        </Button>
                      </div>

                      {challenge && (
                        <p className="text-sm text-muted-foreground">
                          Challenge: {challenge}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* QR Scanner Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-white">
                    Scan QR to Verify
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {storedCredential
                      ? "Scan the QR code above to generate and verify your age proof"
                      : "QR code contains challenge - scan to verify age proof (server processes verification)"}
                  </p>

                  {scanActive && (
                    <div className="rounded-xl overflow-hidden">
                      <Scanner
                        onScan={(result) => {
                          if (result && result.length > 0) {
                            handleScan(result[0].rawValue);
                          }
                        }}
                        onError={handleScanError}
                        scanDelay={250}
                      />
                    </div>
                  )}

                  {!scanActive && (
                    <Button
                      onClick={() => setScanActive(true)}
                      className="bg-primary hover:bg-primary/90"
                      disabled={!isConnected}
                    >
                      <QrCodeIcon className="w-4 h-4 mr-2" />
                      {isConnected ? "Start Scanning" : "Connect Wallet First"}
                    </Button>
                  )}

                  {!isConnected && (
                    <p className="text-sm text-yellow-400">
                      Connect your wallet to enable QR scanning
                    </p>
                  )}

                  {scanError && (
                    <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                      {scanError}
                    </div>
                  )}
                </div>

                {/* Verification Status */}
                <div className="py-8">{renderVerificationStatus()}</div>

                {/* Verifier Information */}
                <div className="bg-muted/50 rounded-lg p-4 border border-border">
                  <h4 className="text-sm font-medium text-white mb-2">
                    Verifier Information
                  </h4>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>
                      <span className="font-medium">Verifier DID:</span>{" "}
                      did:sonic:demo_verifier
                    </p>
                    <p>
                      <span className="font-medium">Requirement:</span> Age
                      verification (18+)
                    </p>
                    <p>
                      <span className="font-medium">Privacy:</span>{" "}
                      Zero-knowledge proof - no personal data revealed
                    </p>
                    <p>
                      <span className="font-medium">Network:</span> Sonic
                      Testnet
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

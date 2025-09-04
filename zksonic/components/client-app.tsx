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
import { QrCodeIcon, CheckCircle, XCircle, Loader2 } from "lucide-react";

type VerificationStatus =
  | "awaiting"
  | "verifying"
  | "signing"
  | "success"
  | "failed";
type WalletStatus = "disconnected" | "connecting" | "connected" | "error";

export default function ClientApp() {
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
  const [verificationStatus, setVerificationStatus] =
    useState<VerificationStatus>("awaiting");
  const [verificationData, setVerificationData] = useState<any>(null);
  const [qrCodeData, setQrCodeData] = useState("");
  const [challenge, setChallenge] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [scanActive, setScanActive] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const [issueForm, setIssueForm] = useState({
    recipientDID: "",
    birthYear: new Date().getFullYear() - 25,
    birthMonth: 1,
    birthDay: 1,
  });

  const [theme, setTheme] = useState<"light" | "dark">("dark");

  const { toast } = useToast();

  // Get stored user DID
  const storedUserDid = getUserDid();

  // Load credential from localStorage on mount
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

  // Get user DID from address
  const userDID = address ? didFromAddress(address) : "";

  // Check if connected to correct network
  const isCorrectNetwork = chainId === ADDRESSES.chainId;

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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-foreground">ZKSONIC</h1>
              <Badge variant="secondary" className="text-xs">
                ZKP-Enabled Identity
              </Badge>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleTheme}
                className="hidden sm:flex"
              >
                {theme === "dark" ? "☀️" : "🌙"}
              </Button>
              <ConnectButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Decentralized Identity with Zero-Knowledge Proofs
            </h2>
            <p className="text-muted-foreground text-lg">
              Register DIDs, issue credentials, and verify age proofs on Sonic
              Testnet
            </p>
          </div>

          {/* Wallet Status */}
          {isConnected && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Wallet Connected</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Address:</span>
                    <br />
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {truncateAddress(address || "")}
                    </code>
                  </div>
                  <div>
                    <span className="font-medium">Balance:</span>
                    <br />
                    <span className="text-xs">
                      {balance
                        ? `${parseFloat(balance.formatted).toFixed(4)} ${
                            balance.symbol
                          }`
                        : "Loading..."}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">DID:</span>
                    <br />
                    <span className="text-xs">
                      {storedUserDid
                        ? truncateAddress(storedUserDid)
                        : "Not registered"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Main Tabs */}
          <Tabs defaultValue="register" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="register">Register DID</TabsTrigger>
              <TabsTrigger value="issue">Issue Credential</TabsTrigger>
              <TabsTrigger value="verify">Verify Proof</TabsTrigger>
              <TabsTrigger value="credential">My Credential</TabsTrigger>
            </TabsList>

            {/* Register DID Tab */}
            <TabsContent value="register" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Register Decentralized Identifier (DID)</CardTitle>
                  <CardDescription>
                    Create a unique identifier linked to your wallet address
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!isConnected ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">
                        Connect your wallet to register a DID
                      </p>
                      <ConnectButton />
                    </div>
                  ) : storedUserDid ? (
                    <div className="text-center py-8">
                      <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">
                        DID Already Registered
                      </h3>
                      <p className="text-muted-foreground mb-4">
                        Your DID:{" "}
                        <code className="bg-muted px-2 py-1 rounded text-sm">
                          {storedUserDid}
                        </code>
                      </p>
                      <Button
                        onClick={() => {
                          navigator.clipboard.writeText(storedUserDid);
                          toast({
                            title: "DID Copied",
                            description:
                              "DID has been copied to your clipboard",
                          });
                        }}
                        variant="outline"
                      >
                        Copy DID
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="text-center">
                        <p className="text-muted-foreground mb-4">
                          Register a new DID for address:{" "}
                          {truncateAddress(address || "")}
                        </p>
                        <Button
                          onClick={async () => {
                            if (!walletClient) return;
                            setIsRegistering(true);
                            try {
                              const result = await registerDidWithWallet(
                                walletClient,
                                ""
                              );
                              if (result.success) {
                                toast({
                                  title: "DID Registered",
                                  description: `DID registered successfully: ${result.did}`,
                                });
                                // Refresh the page to update the UI
                                window.location.reload();
                              } else {
                                throw new Error(
                                  result.error || "Failed to register DID"
                                );
                              }
                            } catch (error: any) {
                              toast({
                                title: "Registration Failed",
                                description:
                                  error.message || "Failed to register DID",
                                variant: "destructive",
                              });
                            } finally {
                              setIsRegistering(false);
                            }
                          }}
                          disabled={isRegistering}
                          className="w-full"
                        >
                          {isRegistering ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Registering...
                            </>
                          ) : (
                            "Register DID"
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Issue Credential Tab */}
            <TabsContent value="issue" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Issue Age Credential</CardTitle>
                  <CardDescription>
                    Create a verifiable credential with age information
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!isConnected ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">
                        Connect your wallet to issue credentials
                      </p>
                      <ConnectButton />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="recipientDID">Recipient DID</Label>
                          <div className="flex space-x-2">
                            <Input
                              id="recipientDID"
                              value={issueForm.recipientDID}
                              onChange={(e) =>
                                setIssueForm((prev) => ({
                                  ...prev,
                                  recipientDID: e.target.value,
                                }))
                              }
                              placeholder="did:zksonic:0x..."
                              className="flex-1"
                            />
                            {storedUserDid && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setIssueForm((prev) => ({
                                    ...prev,
                                    recipientDID: storedUserDid,
                                  }))
                                }
                              >
                                Use My DID
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="birthYear">Birth Year</Label>
                          <Input
                            id="birthYear"
                            type="number"
                            value={issueForm.birthYear}
                            onChange={(e) =>
                              setIssueForm((prev) => ({
                                ...prev,
                                birthYear: parseInt(e.target.value) || 2000,
                              }))
                            }
                            min="1900"
                            max={new Date().getFullYear()}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="birthMonth">Birth Month</Label>
                          <Select
                            value={issueForm.birthMonth.toString()}
                            onValueChange={(value) =>
                              setIssueForm((prev) => ({
                                ...prev,
                                birthMonth: parseInt(value),
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 12 }, (_, i) => (
                                <SelectItem
                                  key={i + 1}
                                  value={(i + 1).toString()}
                                >
                                  {new Date(2000, i, 1).toLocaleString(
                                    "default",
                                    {
                                      month: "long",
                                    }
                                  )}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="birthDay">Birth Day</Label>
                          <Input
                            id="birthDay"
                            type="number"
                            value={issueForm.birthDay}
                            onChange={(e) =>
                              setIssueForm((prev) => ({
                                ...prev,
                                birthDay: parseInt(e.target.value) || 1,
                              }))
                            }
                            min="1"
                            max="31"
                          />
                        </div>
                      </div>
                      <Button
                        onClick={async () => {
                          if (!issueForm.recipientDID) {
                            toast({
                              title: "Missing Information",
                              description: "Please enter a recipient DID",
                              variant: "destructive",
                            });
                            return;
                          }
                          setIsIssuing(true);
                          try {
                            const credential: AgeCredential = {
                              type: "AgeCredential",
                              subjectDid: issueForm.recipientDID,
                              birthYear: issueForm.birthYear,
                              birthMonth: issueForm.birthMonth,
                              birthDay: issueForm.birthDay,
                              issuer: "did:zksonic:demo-issuer",
                              issuedAt: new Date().toISOString(),
                              expiresAt: new Date(
                                Date.now() + 365 * 24 * 60 * 60 * 1000
                              ).toISOString(),
                            };
                            setCredential(credential);
                            setCredentialState(credential);
                            toast({
                              title: "Credential Issued",
                              description:
                                "Age credential has been created successfully",
                            });
                          } catch (error: any) {
                            toast({
                              title: "Issuance Failed",
                              description:
                                error.message || "Failed to issue credential",
                              variant: "destructive",
                            });
                          } finally {
                            setIsIssuing(false);
                          }
                        }}
                        disabled={isIssuing}
                        className="w-full"
                      >
                        {isIssuing ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Issuing...
                          </>
                        ) : (
                          "Issue Credential"
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Verify Proof Tab */}
            <TabsContent value="verify" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Verify Age Proof</CardTitle>
                  <CardDescription>
                    Scan a QR code to verify an age proof using zero-knowledge
                    proofs
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!isConnected ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">
                        Connect your wallet to verify proofs
                      </p>
                      <ConnectButton />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {verificationStatus === "awaiting" && (
                        <div className="text-center py-8">
                          <QrCodeIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                          <p className="text-muted-foreground mb-4">
                            Scan a QR code to verify an age proof
                          </p>
                          {!scanActive ? (
                            <Button
                              onClick={() => setScanActive(true)}
                              className="bg-primary hover:bg-primary/90"
                            >
                              <QrCodeIcon className="w-4 h-4 mr-2" />
                              Start Scanning
                            </Button>
                          ) : (
                            <div className="space-y-4">
                              <div className="relative w-full max-w-md mx-auto">
                                <Scanner
                                  onResult={(result) => {
                                    if (result && result.length > 0) {
                                      handleScan(result[0].rawValue);
                                    }
                                  }}
                                  onError={handleScanError}
                                  scanDelay={250}
                                />
                              </div>
                              <Button
                                onClick={() => setScanActive(false)}
                                variant="outline"
                              >
                                Stop Scanning
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      {verificationStatus === "verifying" && (
                        <div className="text-center py-8">
                          <Loader2 className="w-12 h-12 text-blue-500 mx-auto mb-4 animate-spin" />
                          <h3 className="text-lg font-semibold mb-2">
                            Verifying Proof
                          </h3>
                          <p className="text-muted-foreground">
                            Generating zero-knowledge proof...
                          </p>
                        </div>
                      )}

                      {verificationStatus === "signing" && (
                        <div className="text-center py-8">
                          <Loader2 className="w-12 h-12 text-yellow-500 mx-auto mb-4 animate-spin" />
                          <h3 className="text-lg font-semibold mb-2">
                            Verifying on Blockchain
                          </h3>
                          <p className="text-muted-foreground">
                            Verifying proof with Groth16Verifier...
                          </p>
                        </div>
                      )}

                      {verificationStatus === "success" && verificationData && (
                        <div className="text-center py-8">
                          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                          <h3 className="text-lg font-semibold mb-2 text-green-600">
                            Verification Successful
                          </h3>
                          <p className="text-muted-foreground mb-4">
                            Age proof has been verified successfully
                          </p>
                          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg text-left">
                            <h4 className="font-medium mb-2">
                              Verification Details:
                            </h4>
                            <div className="space-y-1 text-sm">
                              <div>
                                <span className="font-medium">Status:</span>{" "}
                                Verified
                              </div>
                              <div>
                                <span className="font-medium">Timestamp:</span>{" "}
                                {new Date(
                                  verificationData.timestamp
                                ).toLocaleString()}
                              </div>
                              {verificationData.message && (
                                <div>
                                  <span className="font-medium">Message:</span>{" "}
                                  {verificationData.message}
                                </div>
                              )}
                            </div>
                          </div>
                          <Button
                            onClick={resetVerification}
                            variant="outline"
                            className="mt-4"
                          >
                            Verify Another Proof
                          </Button>
                        </div>
                      )}

                      {verificationStatus === "failed" && verificationData && (
                        <div className="text-center py-8">
                          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                          <h3 className="text-lg font-semibold mb-2 text-red-600">
                            Verification Failed
                          </h3>
                          <p className="text-muted-foreground mb-4">
                            {verificationData?.ageVerified === false
                              ? "Age verification failed - User is under 18"
                              : "Unable to verify the submitted proof"}
                          </p>
                          {verificationData.error && (
                            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg text-left mb-4">
                              <h4 className="font-medium mb-2">
                                Error Details:
                              </h4>
                              <p className="text-sm text-red-600 dark:text-red-400">
                                {verificationData.error}
                              </p>
                            </div>
                          )}
                          <Button
                            onClick={resetVerification}
                            variant="outline"
                            className="mt-4"
                          >
                            Try Again
                          </Button>
                        </div>
                      )}

                      {scanError && (
                        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                          <h4 className="font-medium text-red-800 dark:text-red-200 mb-2">
                            Scan Error
                          </h4>
                          <p className="text-sm text-red-600 dark:text-red-400">
                            {scanError}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* My Credential Tab */}
            <TabsContent value="credential" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>My Age Credential</CardTitle>
                  <CardDescription>
                    View and manage your issued age credential
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!credential ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">
                        No credential issued yet
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Go to the "Issue Credential" tab to create one
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="bg-muted p-4 rounded-lg">
                        <h4 className="font-medium mb-2">Credential Details</h4>
                        <div className="space-y-1 text-sm">
                          <div>
                            <span className="font-medium">Type:</span>{" "}
                            {credential.type}
                          </div>
                          <div>
                            <span className="font-medium">Subject DID:</span>{" "}
                            <code className="bg-background px-2 py-1 rounded text-xs">
                              {credential.subjectDid}
                            </code>
                          </div>
                          <div>
                            <span className="font-medium">Birth Date:</span>{" "}
                            {credential.birthYear}-
                            {credential.birthMonth.toString().padStart(2, "0")}-
                            {credential.birthDay.toString().padStart(2, "0")}
                          </div>
                          <div>
                            <span className="font-medium">Issuer:</span>{" "}
                            {credential.issuer}
                          </div>
                          <div>
                            <span className="font-medium">Issued:</span>{" "}
                            {new Date(credential.issuedAt).toLocaleString()}
                          </div>
                          <div>
                            <span className="font-medium">Expires:</span>{" "}
                            {new Date(credential.expiresAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          onClick={() => {
                            navigator.clipboard.writeText(
                              JSON.stringify(credential, null, 2)
                            );
                            toast({
                              title: "Credential Copied",
                              description:
                                "Credential has been copied to your clipboard",
                            });
                          }}
                          variant="outline"
                        >
                          Copy Credential
                        </Button>
                        <Button
                          onClick={() => {
                            setCredential(null);
                            setCredentialState(null);
                            toast({
                              title: "Credential Deleted",
                              description: "Credential has been removed",
                            });
                          }}
                          variant="destructive"
                        >
                          Delete Credential
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

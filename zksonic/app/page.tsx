"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
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
  QrCode,
  X,
  RefreshCw,
  AlertTriangle,
  Wifi,
  WifiOff,
  Sun,
  Moon,
} from "lucide-react"

interface Credential {
  id: string
  type: string
  issuer: string
  issuedAt: string
  status: "active" | "expired" | "revoked"
  data: {
    [key: string]: any
  }
}

type VerificationStatus = "awaiting" | "verifying" | "success" | "failed"
type WalletStatus = "disconnected" | "connecting" | "connected" | "error"

export default function ZKSonicApp() {
  // Wallet state
  const [walletStatus, setWalletStatus] = useState<WalletStatus>("disconnected")
  const [walletAddress, setWalletAddress] = useState("")
  const [walletBalance, setWalletBalance] = useState("0")
  const [networkName, setNetworkName] = useState("Sonic Testnet")
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(true)

  // App state
  const [userDID, setUserDID] = useState("")
  const [isRegistering, setIsRegistering] = useState(false)
  const [credentials, setCredentials] = useState<Credential[]>([
    // Mock credential for demo
    {
      id: "cred_001",
      type: "Age Credential",
      issuer: "did:sonic:issuer123",
      issuedAt: "2024-01-15T10:30:00Z",
      status: "active",
      data: {
        ageOver18: true,
        issuedDate: "2024-01-15",
        expiryDate: "2025-01-15",
      },
    },
  ])

  const [issueForm, setIssueForm] = useState({
    recipientDID: "",
    credentialType: "",
    birthDate: "",
    birthMonth: "",
    birthYear: "",
  })
  const [isIssuing, setIsIssuing] = useState(false)

  // Verification state
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>("awaiting")
  const [verificationData, setVerificationData] = useState<any>(null)
  const [qrCodeData, setQrCodeData] = useState("")

  // Theme state management
  const [theme, setTheme] = useState<"light" | "dark">("dark")

  const { toast } = useToast()

  // Generate QR code data on component mount
  useEffect(() => {
    const verificationRequest = {
      type: "age_verification",
      requirement: "18+",
      verifier: "did:sonic:demo_verifier",
      challenge: `challenge_${Date.now()}`,
      callback: `${window.location.origin}/verify`,
    }
    setQrCodeData(JSON.stringify(verificationRequest))
  }, [])

  // Mock verification simulation
  useEffect(() => {
    if (verificationStatus === "verifying") {
      const timer = setTimeout(() => {
        // Randomly simulate success or failure for demo
        const isSuccess = Math.random() > 0.3 // 70% success rate
        if (isSuccess) {
          setVerificationStatus("success")
          setVerificationData({
            ageVerified: true,
            timestamp: new Date().toISOString(),
            proofHash: `0x${Math.random().toString(16).slice(2, 18)}`,
          })
          toast({
            title: "Verification Successful",
            description: "Age proof has been successfully verified",
          })
        } else {
          setVerificationStatus("failed")
          setVerificationData({
            error: "Invalid proof or credential expired",
            timestamp: new Date().toISOString(),
          })
          toast({
            title: "Verification Failed",
            description: "Unable to verify age proof",
            variant: "destructive",
          })
        }
      }, 3000)

      return () => clearTimeout(timer)
    }
  }, [verificationStatus, toast])

  // Mock wallet detection and connection
  const detectWallet = () => {
    // Simulate wallet detection
    return Math.random() > 0.1 // 90% chance wallet is available
  }

  const connectWallet = async () => {
    if (!detectWallet()) {
      toast({
        title: "Wallet Not Found",
        description: "Please install MetaMask or another Web3 wallet",
        variant: "destructive",
      })
      return
    }

    setWalletStatus("connecting")

    try {
      // Simulate wallet connection process
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Simulate random connection success/failure
      if (Math.random() > 0.1) {
        // 90% success rate
        const mockAddress = `0x${Math.random().toString(16).slice(2, 10)}${Math.random()
          .toString(16)
          .slice(2, 10)}${Math.random().toString(16).slice(2, 10)}${Math.random().toString(16).slice(2, 10)}`
        const mockBalance = (Math.random() * 10).toFixed(4)

        setWalletAddress(mockAddress)
        setWalletBalance(mockBalance)
        setWalletStatus("connected")

        // Simulate network check
        const networks = ["Sonic Testnet", "Ethereum Mainnet", "Polygon", "BSC"]
        const currentNetwork = networks[Math.floor(Math.random() * networks.length)]
        setNetworkName(currentNetwork)
        setIsCorrectNetwork(currentNetwork === "Sonic Testnet")

        toast({
          title: "Wallet Connected",
          description: `Successfully connected to ${truncateAddress(mockAddress)}`,
        })
      } else {
        throw new Error("User rejected connection")
      }
    } catch (error) {
      setWalletStatus("error")
      toast({
        title: "Connection Failed",
        description: "Failed to connect wallet. Please try again.",
        variant: "destructive",
      })

      // Reset to disconnected after 3 seconds
      setTimeout(() => {
        setWalletStatus("disconnected")
      }, 3000)
    }
  }

  const disconnectWallet = () => {
    setWalletStatus("disconnected")
    setWalletAddress("")
    setWalletBalance("0")
    setUserDID("")
    setNetworkName("Sonic Testnet")
    setIsCorrectNetwork(true)
    toast({
      title: "Wallet Disconnected",
      description: "Your wallet has been disconnected",
    })
  }

  const switchToSonicNetwork = async () => {
    toast({
      title: "Switching Network",
      description: "Please approve the network switch in your wallet",
    })

    // Simulate network switch
    setTimeout(() => {
      setNetworkName("Sonic Testnet")
      setIsCorrectNetwork(true)
      toast({
        title: "Network Switched",
        description: "Successfully switched to Sonic Testnet",
      })
    }, 2000)
  }

  const registerDID = async () => {
    if (!isCorrectNetwork) {
      toast({
        title: "Wrong Network",
        description: "Please switch to Sonic Testnet to register a DID",
        variant: "destructive",
      })
      return
    }

    setIsRegistering(true)
    // Mock DID registration
    setTimeout(() => {
      const mockDID = `did:sonic:${walletAddress.slice(2, 8)}${Date.now().toString().slice(-6)}`
      setUserDID(mockDID)
      setIsRegistering(false)
      toast({
        title: "DID Registered",
        description: "Your decentralized identity has been successfully registered",
      })
    }, 2000)
  }

  const issueCredential = async () => {
    if (!isCorrectNetwork) {
      toast({
        title: "Wrong Network",
        description: "Please switch to Sonic Testnet to issue credentials",
        variant: "destructive",
      })
      return
    }

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
      })
      return
    }

    setIsIssuing(true)

    // Mock credential issuance
    setTimeout(() => {
      const birthDate = new Date(
        Number.parseInt(issueForm.birthYear),
        Number.parseInt(issueForm.birthMonth) - 1,
        Number.parseInt(issueForm.birthDate),
      )
      const age = Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000))

      const newCredential: Credential = {
        id: `cred_${Date.now()}`,
        type: issueForm.credentialType,
        issuer: "did:sonic:demo_issuer",
        issuedAt: new Date().toISOString(),
        status: "active",
        data: {
          ageOver18: age >= 18,
          age: age,
          birthDate: birthDate.toISOString().split("T")[0],
          issuedDate: new Date().toISOString().split("T")[0],
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        },
      }

      setCredentials((prev) => [...prev, newCredential])
      setIssueForm({
        recipientDID: "",
        credentialType: "",
        birthDate: "",
        birthMonth: "",
        birthYear: "",
      })
      setIsIssuing(false)

      toast({
        title: "Credential Issued",
        description: `${issueForm.credentialType} has been successfully issued`,
      })
    }, 2000)
  }

  const simulateVerification = () => {
    setVerificationStatus("verifying")
    setVerificationData(null)
  }

  const resetVerification = () => {
    setVerificationStatus("awaiting")
    setVerificationData(null)
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied to Clipboard",
      description: `${label} has been copied to your clipboard`,
    })
  }

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500/20 text-green-400 border-green-500/30"
      case "expired":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
      case "revoked":
        return "bg-red-500/20 text-red-400 border-red-500/30"
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="w-3 h-3" />
      case "expired":
        return <Clock className="w-3 h-3" />
      default:
        return <Clock className="w-3 h-3" />
    }
  }

  const generateYears = () => {
    const currentYear = new Date().getFullYear()
    const years = []
    for (let year = currentYear - 100; year <= currentYear; year++) {
      years.push(year)
    }
    return years.reverse()
  }

  const renderWalletButton = () => {
    switch (walletStatus) {
      case "disconnected":
        return (
          <Button onClick={connectWallet} className="bg-primary hover:bg-primary/90">
            <Wallet className="w-4 h-4 mr-2" />
            Connect Wallet
          </Button>
        )
      case "connecting":
        return (
          <Button disabled className="bg-primary/50">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
            Connecting...
          </Button>
        )
      case "connected":
        return (
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="bg-card border border-border">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${isCorrectNetwork ? "bg-green-400" : "bg-yellow-400"}`} />
                  <span>{truncateAddress(walletAddress)}</span>
                </div>
              </Badge>
              <Badge variant="outline" className="border-border bg-transparent text-muted-foreground">
                {walletBalance} ETH
              </Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={disconnectWallet}
              className="border-border hover:bg-muted bg-transparent"
            >
              Disconnect
            </Button>
          </div>
        )
      case "error":
        return (
          <Button onClick={connectWallet} variant="destructive">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Retry Connection
          </Button>
        )
    }
  }

  const renderNetworkWarning = () => {
    if (walletStatus === "connected" && !isCorrectNetwork) {
      return (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <WifiOff className="w-5 h-5 text-yellow-400" />
              <div>
                <h4 className="text-sm font-medium text-yellow-400">Wrong Network</h4>
                <p className="text-xs text-yellow-400/80">
                  You're connected to {networkName}. Switch to Sonic Testnet to use ZKSONIC.
                </p>
              </div>
            </div>
            <Button onClick={switchToSonicNetwork} size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-black">
              <Wifi className="w-4 h-4 mr-2" />
              Switch Network
            </Button>
          </div>
        </div>
      )
    }
    return null
  }

  const renderVerificationStatus = () => {
    switch (verificationStatus) {
      case "awaiting":
        return (
          <div className="text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Awaiting Proof Verification</h3>
            <p className="text-muted-foreground mb-4">Scan the QR code above to submit your age proof</p>
            <Button onClick={simulateVerification} variant="outline" className="border-border bg-transparent">
              <RefreshCw className="w-4 h-4 mr-2" />
              Simulate Verification
            </Button>
          </div>
        )
      case "verifying":
        return (
          <div className="text-center">
            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Verifying Proof...</h3>
            <p className="text-muted-foreground">Processing zero-knowledge proof verification</p>
          </div>
        )
      case "success":
        return (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-lg font-medium text-green-400 mb-2">Verification Successful!</h3>
            <p className="text-muted-foreground mb-4">Age proof has been successfully verified</p>
            {verificationData && (
              <div className="bg-muted/50 rounded-lg p-4 border border-border text-left">
                <h4 className="text-sm font-medium text-white mb-2">Verification Details</h4>
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
                    <span className="font-medium">Proof Hash:</span> {verificationData.proofHash}
                  </p>
                </div>
              </div>
            )}
            <Button onClick={resetVerification} className="mt-4 bg-primary hover:bg-primary/90">
              Verify Another Proof
            </Button>
          </div>
        )
      case "failed":
        return (
          <div className="text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <X className="w-8 h-8 text-red-400" />
            </div>
            <h3 className="text-lg font-medium text-red-400 mb-2">Verification Failed</h3>
            <p className="text-muted-foreground mb-4">Unable to verify the submitted proof</p>
            {verificationData && (
              <div className="bg-muted/50 rounded-lg p-4 border border-border text-left">
                <h4 className="text-sm font-medium text-white mb-2">Error Details</h4>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>
                    <span className="font-medium">Error:</span> {verificationData.error}
                  </p>
                  <p>
                    <span className="font-medium">Timestamp:</span>{" "}
                    {new Date(verificationData.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            )}
            <Button onClick={resetVerification} variant="outline" className="mt-4 border-border bg-transparent">
              Try Again
            </Button>
          </div>
        )
    }
  }

  // Theme toggle functionality with persistence
  useEffect(() => {
    const savedTheme = localStorage.getItem("zksonic-theme") as "light" | "dark" | null
    if (savedTheme) {
      setTheme(savedTheme)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem("zksonic-theme", theme)
    document.documentElement.classList.toggle("dark", theme === "dark")
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"))
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">ZKSONIC</h1>
                <p className="text-sm text-muted-foreground">ZKP-Enabled Identity</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="icon" onClick={toggleTheme} className="w-9 h-9">
                {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
              {renderWalletButton()}
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
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <User className="w-4 h-4 mr-2" />
              My Identity
            </TabsTrigger>
            <TabsTrigger
              value="issue"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <FileText className="w-4 h-4 mr-2" />
              Issue Credential
            </TabsTrigger>
            <TabsTrigger
              value="verify"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Shield className="w-4 h-4 mr-2" />
              Verify Proof
            </TabsTrigger>
          </TabsList>

          {/* My Identity Tab */}
          <TabsContent value="identity" className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-white">Decentralized Identity</CardTitle>
                <CardDescription>Your unique DID on the Sonic network</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!userDID ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                      <User className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground mb-4">No DID registered yet</p>
                    <Button
                      className="bg-primary hover:bg-primary/90"
                      disabled={walletStatus !== "connected" || !isCorrectNetwork || isRegistering}
                      onClick={registerDID}
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
                    {walletStatus !== "connected" && (
                      <p className="text-sm text-muted-foreground mt-2">Connect your wallet to register a DID</p>
                    )}
                    {walletStatus === "connected" && !isCorrectNetwork && (
                      <p className="text-sm text-yellow-400 mt-2">Switch to Sonic Testnet to register a DID</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                      <span className="text-sm font-medium text-green-400">DID Registered</span>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg border border-border">
                      <code className="font-mono text-sm text-foreground break-all mr-4">{userDID}</code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(userDID, "DID")}
                        className="hover:bg-primary/20 flex-shrink-0"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      This is your unique decentralized identifier on the Sonic network. Use it to receive verifiable
                      credentials.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-white">My Credentials</CardTitle>
                <CardDescription>Verifiable credentials issued to your DID</CardDescription>
              </CardHeader>
              <CardContent>
                {credentials.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">No credentials issued yet</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Credentials will appear here once they are issued to your DID
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {credentials.map((credential) => (
                      <div
                        key={credential.id}
                        className="p-4 border border-border rounded-lg hover:border-primary/50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <h4 className="font-medium text-white">{credential.type}</h4>
                              <Badge className={`text-xs ${getStatusColor(credential.status)}`}>
                                {getStatusIcon(credential.status)}
                                <span className="ml-1 capitalize">{credential.status}</span>
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-1">
                              Issued by: <code className="font-mono text-xs">{credential.issuer}</code>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Issued: {new Date(credential.issuedAt).toLocaleDateString()}
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
                                <DialogTitle className="text-white">{credential.type}</DialogTitle>
                                <DialogDescription>Credential details and verification information</DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <label className="text-sm font-medium text-white">Credential ID</label>
                                  <div className="flex items-center justify-between p-2 bg-muted rounded mt-1">
                                    <code className="font-mono text-xs text-foreground">{credential.id}</code>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => copyToClipboard(credential.id, "Credential ID")}
                                    >
                                      <Copy className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-white">Issuer</label>
                                  <div className="flex items-center justify-between p-2 bg-muted rounded mt-1">
                                    <code className="font-mono text-xs text-foreground">{credential.issuer}</code>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => copyToClipboard(credential.issuer, "Issuer DID")}
                                    >
                                      <Copy className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-white">Status</label>
                                  <div className="mt-1">
                                    <Badge className={getStatusColor(credential.status)}>
                                      {getStatusIcon(credential.status)}
                                      <span className="ml-1 capitalize">{credential.status}</span>
                                    </Badge>
                                  </div>
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-white">Credential Data</label>
                                  <div className="p-3 bg-muted rounded mt-1">
                                    <pre className="text-xs text-foreground font-mono">
                                      {JSON.stringify(credential.data, null, 2)}
                                    </pre>
                                  </div>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    ))}
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
                <CardDescription>Demo issuer for testing credential issuance on the Sonic network</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="recipientDID" className="text-white">
                      Recipient DID
                    </Label>
                    <Input
                      id="recipientDID"
                      placeholder="did:sonic:example123..."
                      value={issueForm.recipientDID}
                      onChange={(e) => setIssueForm((prev) => ({ ...prev, recipientDID: e.target.value }))}
                      className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter the DID of the recipient who will receive this credential
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="credentialType" className="text-white">
                      Credential Type
                    </Label>
                    <Select
                      value={issueForm.credentialType}
                      onValueChange={(value) => setIssueForm((prev) => ({ ...prev, credentialType: value }))}
                    >
                      <SelectTrigger className="bg-muted border-border text-foreground">
                        <SelectValue placeholder="Select credential type" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        <SelectItem value="Age Credential" className="text-foreground hover:bg-muted">
                          Age Credential
                        </SelectItem>
                        <SelectItem value="Identity Credential" className="text-foreground hover:bg-muted">
                          Identity Credential
                        </SelectItem>
                        <SelectItem value="Education Credential" className="text-foreground hover:bg-muted">
                          Education Credential
                        </SelectItem>
                        <SelectItem value="Employment Credential" className="text-foreground hover:bg-muted">
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
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="birthDate" className="text-xs text-muted-foreground">
                          Day
                        </Label>
                        <Select
                          value={issueForm.birthDate}
                          onValueChange={(value) => setIssueForm((prev) => ({ ...prev, birthDate: value }))}
                        >
                          <SelectTrigger className="bg-muted border-border text-foreground">
                            <SelectValue placeholder="Day" />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border max-h-48">
                            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                              <SelectItem key={day} value={day.toString()} className="text-foreground hover:bg-muted">
                                {day}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="birthMonth" className="text-xs text-muted-foreground">
                          Month
                        </Label>
                        <Select
                          value={issueForm.birthMonth}
                          onValueChange={(value) => setIssueForm((prev) => ({ ...prev, birthMonth: value }))}
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
                        <Label htmlFor="birthYear" className="text-xs text-muted-foreground">
                          Year
                        </Label>
                        <Select
                          value={issueForm.birthYear}
                          onValueChange={(value) => setIssueForm((prev) => ({ ...prev, birthYear: value }))}
                        >
                          <SelectTrigger className="bg-muted border-border text-foreground">
                            <SelectValue placeholder="Year" />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border max-h-48">
                            {generateYears().map((year) => (
                              <SelectItem key={year} value={year.toString()} className="text-foreground hover:bg-muted">
                                {year}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Birth date information will be used to generate age-related proofs
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-border">
                  <Button
                    onClick={issueCredential}
                    disabled={isIssuing || walletStatus !== "connected" || !isCorrectNetwork}
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
                  {walletStatus !== "connected" && (
                    <p className="text-sm text-muted-foreground mt-2 text-center">
                      Connect your wallet to issue credentials
                    </p>
                  )}
                  {walletStatus === "connected" && !isCorrectNetwork && (
                    <p className="text-sm text-yellow-400 mt-2 text-center">
                      Switch to Sonic Testnet to issue credentials
                    </p>
                  )}
                </div>

                <div className="bg-muted/50 rounded-lg p-4 border border-border">
                  <h4 className="text-sm font-medium text-white mb-2">Demo Issuer Information</h4>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>
                      <span className="font-medium">Issuer DID:</span> did:sonic:demo_issuer
                    </p>
                    <p>
                      <span className="font-medium">Network:</span> Sonic Testnet
                    </p>
                    <p>
                      <span className="font-medium">Credential Validity:</span> 1 year from issuance
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
                <CardDescription>Scan QR code to verify age (18+) using zero-knowledge proof</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* QR Code Section */}
                <div className="text-center">
                  <div className="inline-block p-6 bg-white rounded-lg border-2 border-border">
                    <div className="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center relative">
                      {/* QR Code Pattern - Simplified visual representation */}
                      <div className="grid grid-cols-8 gap-1 w-40 h-40">
                        {Array.from({ length: 64 }, (_, i) => (
                          <div key={i} className={`w-full h-full ${Math.random() > 0.5 ? "bg-black" : "bg-white"}`} />
                        ))}
                      </div>
                      <QrCode className="absolute inset-0 w-full h-full text-black/20" />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-4">Scan to Verify Age (18+)</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(qrCodeData, "QR Code Data")}
                    className="mt-2 border-border bg-transparent"
                  >
                    <Copy className="w-3 h-3 mr-2" />
                    Copy QR Data
                  </Button>
                </div>

                {/* Verification Status */}
                <div className="py-8">{renderVerificationStatus()}</div>

                {/* Verifier Information */}
                <div className="bg-muted/50 rounded-lg p-4 border border-border">
                  <h4 className="text-sm font-medium text-white mb-2">Verifier Information</h4>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>
                      <span className="font-medium">Verifier DID:</span> did:sonic:demo_verifier
                    </p>
                    <p>
                      <span className="font-medium">Requirement:</span> Age verification (18+)
                    </p>
                    <p>
                      <span className="font-medium">Privacy:</span> Zero-knowledge proof - no personal data revealed
                    </p>
                    <p>
                      <span className="font-medium">Network:</span> Sonic Testnet
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
